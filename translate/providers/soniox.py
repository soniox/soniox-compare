import asyncio
import json
import logging
import time

import httpx
import websockets

from providers.base import BaseProvider
from providers.config import (
    TTS_OUTPUT_SAMPLE_RATE,
    FeatureStatus,
    ProviderConfig,
    ProviderError,
    SupportedFeatures,
)
from utils import audio_event, data_event, error_message, make_part, session_done_event

log = logging.getLogger("translate.soniox")

TTS_ENDPOINT = "https://api.soniox.com/v1/tts-models"
STT_MODEL = "stt-rt-v5"
TTS_MODEL = "tts-rt-v2"
TTS_KEEPALIVE_SEC = 10
STT_KEEPALIVE_SEC = 10
# Bounds the post-send_end shutdown — Soniox doesn't always emit
# `finished: true` after the empty frame, so the recv loop force-closes
# the WS at the deadline.
STT_DRAIN_TIMEOUT_SEC = 5
# Max concurrent TTS streams against Soniox's `tts_concurrent` quota.
# A stream holds a slot from `tts.stream.open` until `terminated`, which
# for a long utterance can outlast the post-`text_end` drain by 5–10 s.
# Two lets the next utterance's stream pre-warm while the previous one
# finishes; raise it if your org cap is higher.
MAX_CONCURRENT_TTS_STREAMS = 2


class SonioxProvider(BaseProvider):
    """Soniox runs translation on the STT socket itself, via
    `translation: {type: "one_way"}`. Speech synthesis is a *separate* socket,
    so text mode simply never opens it."""

    name = "soniox"

    def __init__(self, config: ProviderConfig):
        super().__init__(config)
        self.api_key = config.service.api_key
        self._stt_ws: websockets.ClientConnection | None = None
        self._tts_ws: websockets.ClientConnection | None = None
        self._text_queue: asyncio.Queue[tuple[str, str | None] | None] = asyncio.Queue()
        # Set when the playback queue drains, so session shutdown waits
        # for tail audio before sending `session_done`.
        self._tts_idle: asyncio.Event = asyncio.Event()
        self._tts_idle.set()
        self._current_stream_id: str | None = None
        # Streams in the order we opened them. The recv loop forwards audio
        # to the client in this order regardless of which stream Soniox
        # emits a chunk for first — otherwise concurrent streams would
        # interleave and playback would be mashed together.
        self._stream_playback_order: list[str] = []
        # Per-stream FIFO of audio chunks waiting for an earlier stream
        # ahead of them in playback order to drain.
        self._audio_buffers: dict[str, list[dict]] = {}
        # Streams holding a slot in Soniox's `tts_concurrent` quota.
        # A stream stays here from open until `terminated` (NOT `audio_end`).
        self._open_tts_streams: set[str] = set()
        self._tts_slot_available: asyncio.Event = asyncio.Event()
        self._tts_slot_available.set()
        # Set on `send_end()`. Suppresses speculative warms and STT
        # keepalives so the session can wind down cleanly.
        self._draining: asyncio.Event = asyncio.Event()
        # Mouth-to-ear latency markers, reset when a new stream opens.
        self._utt_first_translation_at: float | None = None
        self._utt_first_text_sent_at: float | None = None
        self._utt_first_audio_logged: bool = False

    @classmethod
    async def list_voices(cls, api_key: str | None = None) -> list[dict]:
        """Query Soniox for currently supported TTS voices."""
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(
                    url=TTS_ENDPOINT, headers={"Authorization": f"Bearer {api_key}"}
                )
                resp.raise_for_status()
                data = resp.json()
                for model in data["models"]:
                    if model["id"] == TTS_MODEL:
                        return model["voices"]
                return []
        except httpx.HTTPError as e:
            raise ProviderError(message=str(e))

    async def connect(self) -> None:
        if self._is_connected:
            return

        for warning in self.validate_provider_capabilities("Soniox"):
            await self.host_queue.put(warning)

        try:
            log.info(
                "stt.connect model=%s sr=%d target=%s mode=%s",
                STT_MODEL,
                self.config.common.sample_rate,
                self.params.target_language,
                self.params.mode,
            )
            # Soniox doesn't reliably respond to WS PINGs; we use the
            # documented application-level keepalives instead. Leaving
            # auto-ping on causes spurious 1011 closes.
            self._stt_ws = await websockets.connect(
                self.service.websocket_url, ping_interval=None
            )
            await self._stt_ws.send(json.dumps(self._build_stt_config()))

            self._tasks = [
                asyncio.create_task(self._stt_send_loop()),
                asyncio.create_task(self._stt_recv_loop()),
                asyncio.create_task(self._stt_keepalive_loop()),
            ]

            if self.emits_audio:
                log.info("tts.connect model=%s voice=%s", TTS_MODEL, self.params.voice)
                self._tts_ws = await websockets.connect(
                    self.service.tts_websocket_url, ping_interval=None
                )
                self._tasks += [
                    asyncio.create_task(self._tts_send_loop()),
                    asyncio.create_task(self._tts_recv_loop()),
                    asyncio.create_task(self._tts_keepalive_loop()),
                ]
            else:
                # Nothing drains `_text_queue` in text mode, so the STT recv
                # loop must not feed it. `_text_drain_loop` stands in for the
                # TTS send loop's end-of-session duty.
                self._tasks.append(asyncio.create_task(self._text_drain_loop()))

            self._is_connected = True
        except ProviderError:
            raise
        except Exception as ex:
            raise ProviderError(f"{ex}")

    async def _close_upstream(self) -> None:
        for ws in (self._stt_ws, self._tts_ws):
            if ws is not None:
                try:
                    await ws.close()
                except Exception:
                    pass
        self._tts_idle.set()

    async def send_end(self) -> None:
        """Signal that no more audio will arrive.

        Sets `_draining` (which stops speculative TTS warms and STT
        keepalives), forwards the empty end-of-audio frame to STT, and
        schedules an unconditional WS force-close: Soniox does not reliably
        emit `finished: true` after b"" — it may keep streaming tail tokens
        for buffered audio and then go silent until its own 20s server-side
        timeout. After STT_DRAIN_TIMEOUT_SEC the WS is closed locally; recv()
        raises ConnectionClosed, the recv loop's finally pushes None down the
        text queue, and the normal teardown path runs.
        """
        if self._draining.is_set():
            return
        log.info("send_end — drain start, force-close in %ds", STT_DRAIN_TIMEOUT_SEC)
        self._draining.set()
        await self._audio_queue.put(("end", None))
        self._tasks.append(asyncio.create_task(self._force_close_stt_after_drain()))

    async def _force_close_stt_after_drain(self) -> None:
        try:
            await asyncio.sleep(STT_DRAIN_TIMEOUT_SEC)
        except asyncio.CancelledError:
            return
        if self._stopped or self._stt_ws is None:
            return
        log.info("stt.drain.force_close — closing WS to unblock recv loop")
        try:
            await self._stt_ws.close()
        except Exception:
            pass

    async def _stt_send_loop(self) -> None:
        try:
            while True:
                kind, payload = await self._audio_queue.get()
                if kind == "audio":
                    await self._stt_ws.send(payload)
                elif kind == "end":
                    # First explicitly ask Soniox to finalize pending tokens.
                    # Without this, the trailing partial of the last utterance
                    # often stays as-is because Soniox waits for either an
                    # endpoint-detection silence window (which may never come
                    # if the audio cut off mid-utterance) or a long internal
                    # timeout. With `finalize`, all pending audio is committed
                    # immediately and re-emitted with `is_final: true`,
                    # followed by a `<fin>` marker.
                    # Then send the empty frame to close the input side; the
                    # `finished` response will follow and the WS will close.
                    await self._stt_ws.send(json.dumps({"type": "finalize"}))
                    await self._stt_ws.send(b"")
                    return
        except websockets.ConnectionClosedOK:
            pass
        except websockets.ConnectionClosedError as e:
            await self.host_queue.put(
                error_message(provider=self.name, message=f"STT send: {e}")
            )

    async def _stt_recv_loop(self) -> None:
        """Read JSON messages from STT WS until Soniox closes it (cleanly via
        `finished: true`, via an error frame, or via the force-close scheduled
        by `send_end` if Soniox stops cooperating)."""
        # Whether we've already asked the TTS loop to pre-open a stream for
        # the current utterance. Reset on `<end>` so the next utterance opens
        # its own stream.
        warmed = False
        speaks = self.emits_audio
        try:
            while True:
                message = await self._stt_ws.recv()
                data = json.loads(message)

                if data.get("error_code") is not None:
                    log.warning(
                        "stt.error code=%s msg=%s",
                        data.get("error_code"),
                        data.get("error_message"),
                    )
                    await self.host_queue.put(
                        error_message(
                            provider=self.name,
                            message=data["error_message"],
                            code=data["error_code"],
                        )
                    )
                    break
                parts = []
                fin_seen = False
                if "tokens" in data:
                    translation_chunk: list[str] = []

                    async def flush_translation_chunk() -> None:
                        if not translation_chunk:
                            return
                        if speaks:
                            await self._text_queue.put(
                                ("text", "".join(translation_chunk))
                            )
                        translation_chunk.clear()

                    for token in data["tokens"]:
                        text = token.get("text")
                        # `<fin>` is the marker Soniox emits after a manual
                        # `finalize`: all pending tokens have been committed as
                        # final. We don't surface it to the client (it's
                        # internal control) and we use it as the cue to wind
                        # down the recv loop without waiting for the `finished`
                        # response or the eventual WS close.
                        if text == "<fin>":
                            await flush_translation_chunk()
                            fin_seen = True
                            continue
                        speaker = token.get("speaker")
                        language = token.get("language")
                        # Translation tokens carry source_language (the spoken
                        # side); originals don't. The frontend uses it to
                        # group the translated text under the same speaker /
                        # source-language block as its originals.
                        source_language = token.get("source_language")
                        translation_status = token.get("translation_status")
                        is_final = token.get("is_final")
                        start_ms = token.get("start_ms")
                        end_ms = token.get("end_ms")

                        parts.append(
                            make_part(
                                text=text,
                                speaker=speaker,
                                language=language,
                                source_language=source_language,
                                translation_status=translation_status,
                                is_final=is_final,
                                start_ms=start_ms,
                                end_ms=end_ms,
                            )
                        )

                        # Pre-open the TTS stream on the first "original"
                        # token so its config round-trip overlaps with
                        # STT's translation work. Skip while draining —
                        # Soniox keeps emitting tokens for a few seconds
                        # after b"" and we'd open streams we never feed.
                        if (
                            speaks
                            and not warmed
                            and translation_status == "original"
                            and not self._draining.is_set()
                        ):
                            await self._text_queue.put(("warm", None))
                            warmed = True

                        if translation_status == "translation":
                            if self._utt_first_translation_at is None:
                                self._utt_first_translation_at = time.monotonic()
                            translation_chunk.append(text or "")
                        else:
                            await flush_translation_chunk()
                        if text == "<end>":
                            await flush_translation_chunk()
                            if speaks:
                                await self._text_queue.put(("end", None))
                            warmed = False
                            # Reset here, not in the TTS loop, so a value
                            # set inside this for-loop isn't clobbered by
                            # `open_stream_if_needed` running for a warm
                            # we just pushed.
                            self._utt_first_translation_at = None
                    await flush_translation_chunk()
                if parts:
                    await self.host_queue.put(
                        data_event(provider=self.name, parts=parts)
                    )
                if data.get("finished") or fin_seen:
                    if fin_seen:
                        log.info("stt.recv saw <fin> — finalization complete")
                    break
        except websockets.ConnectionClosedOK:
            log.info("stt.recv closed-ok")
        except websockets.ConnectionClosed as e:
            log.warning("stt.recv closed code=%s reason=%s", e.code, e.reason)
            await self.host_queue.put(
                error_message(provider=self.name, message=f"STT recv: {e}")
            )
        finally:
            await self._text_queue.put(None)

    async def _text_drain_loop(self) -> None:
        """Text-mode stand-in for `_tts_send_loop`: nothing synthesizes, so the
        session is over as soon as the STT recv loop signals it is done."""
        while True:
            if await self._text_queue.get() is None:
                await self.host_queue.put(session_done_event(provider=self.name))
                return

    async def _tts_send_loop(self) -> None:
        stream_id = 0

        async def open_stream_if_needed() -> None:
            """Open a new TTS stream, respecting the concurrency cap.

            Multiple streams can run concurrently on the same WS — the
            recv loop buffers audio per stream so playback stays in
            opening order. We block here if the org's `tts_concurrent`
            quota is full, since a stream holds its slot until
            `terminated` arrives (well after `text_end`).
            """
            nonlocal stream_id
            if self._current_stream_id is not None:
                return
            while len(self._open_tts_streams) >= MAX_CONCURRENT_TTS_STREAMS:
                self._tts_slot_available.clear()
                await self._tts_slot_available.wait()
            stream_id += 1
            self._current_stream_id = f"stream-{stream_id}"
            self._stream_playback_order.append(self._current_stream_id)
            self._audio_buffers[self._current_stream_id] = []
            self._open_tts_streams.add(self._current_stream_id)
            self._tts_idle.clear()
            # `_utt_first_translation_at` is owned by `_stt_recv_loop`;
            # don't clobber it here.
            self._utt_first_text_sent_at = None
            self._utt_first_audio_logged = False
            await self._tts_ws.send(
                json.dumps(self._build_tts_config(stream_id=self._current_stream_id))
            )
            log.info(
                "tts.stream.open id=%s open_count=%d",
                self._current_stream_id,
                len(self._open_tts_streams),
            )

        async def close_current_stream() -> None:
            if self._current_stream_id is None:
                return
            await self._tts_ws.send(
                json.dumps(
                    {
                        "stream_id": self._current_stream_id,
                        "text": "",
                        "text_end": True,
                    }
                )
            )
            log.info("tts.stream.close id=%s", self._current_stream_id)
            self._current_stream_id = None

        async def send_text_and_close_stream(text: str) -> None:
            if self._current_stream_id is None:
                return
            await self._tts_ws.send(
                json.dumps(
                    {
                        "stream_id": self._current_stream_id,
                        "text": text,
                        "text_end": True,
                    }
                )
            )
            log.info("tts.stream.text_end id=%s", self._current_stream_id)
            self._current_stream_id = None

        try:
            while True:
                data = await self._text_queue.get()
                if data is None:
                    if self._current_stream_id is not None:
                        await close_current_stream()
                    await self._tts_idle.wait()
                    await self.host_queue.put(session_done_event(provider=self.name))
                    await self._tts_ws.close()
                    return

                kind, payload = data
                # Drop speculative warms during drain — they'd open a
                # stream nothing is going to feed. Text always opens a
                # stream; trailing translations after `finalize` still
                # need to be spoken.
                if self._draining.is_set() and kind == "warm":
                    continue
                if kind == "warm":
                    await open_stream_if_needed()
                elif kind == "text":
                    await open_stream_if_needed()
                    if self._utt_first_text_sent_at is None:
                        now = time.monotonic()
                        self._utt_first_text_sent_at = now
                        if self._utt_first_translation_at is not None:
                            log.info(
                                "tts.first_text id=%s queue_lag_ms=%.0f",
                                self._current_stream_id,
                                (now - self._utt_first_translation_at) * 1000,
                            )
                    await send_text_and_close_stream(payload)
                elif kind == "end":
                    # Always close, even if only `warm` was sent — a
                    # warmed-but-unfed stream would otherwise hang until
                    # Soniox times it out.
                    if self._current_stream_id is not None:
                        await close_current_stream()

        except websockets.ConnectionClosedOK:
            pass
        except websockets.ConnectionClosed as e:
            await self.host_queue.put(
                error_message(provider=self.name, message=f"TTS send: {e}")
            )

    async def _flush_audio_in_order(self) -> None:
        """Forward buffered audio chunks in stream-creation order. Stops
        when the head stream's buffer is empty (still producing)."""
        while self._stream_playback_order:
            head_sid = self._stream_playback_order[0]
            buf = self._audio_buffers.get(head_sid)
            if not buf:
                break
            chunk = buf.pop(0)
            await self.host_queue.put(
                audio_event(
                    provider=self.name,
                    pcm_b64=chunk["audio"],
                    sample_rate=TTS_OUTPUT_SAMPLE_RATE,
                )
            )
            if chunk.get("audio_end"):
                self._stream_playback_order.pop(0)
                self._audio_buffers.pop(head_sid, None)
        if not self._stream_playback_order:
            self._tts_idle.set()

    async def _tts_recv_loop(self) -> None:
        try:
            while True:
                response = await self._tts_ws.recv()
                data = json.loads(response)
                if "error_code" in data:
                    error_type = data.get("error_type")
                    stream_id = data.get("stream_id")
                    # `request_timeout` is recoverable — fires when a
                    # pre-warmed stream sat open without enough text. The
                    # `terminated` that follows resets our state.
                    if error_type == "request_timeout" and stream_id:
                        log.info(
                            "tts.stream.timeout id=%s msg=%s (recovering silently)",
                            stream_id,
                            data.get("error_message"),
                        )
                    else:
                        log.warning(
                            "tts.error type=%s code=%s msg=%s",
                            error_type,
                            data.get("error_code"),
                            data.get("error_message"),
                        )
                        await self.host_queue.put(
                            error_message(
                                provider=self.name,
                                message=data["error_message"],
                                code=data["error_code"],
                            )
                        )
                elif "audio" in data:
                    if (
                        not self._utt_first_audio_logged
                        and self._utt_first_text_sent_at is not None
                    ):
                        now = time.monotonic()
                        log.info(
                            "tts.first_audio id=%s text_to_audio_ms=%.0f"
                            " translation_to_audio_ms=%s",
                            data.get("stream_id"),
                            (now - self._utt_first_text_sent_at) * 1000,
                            f"{(now - self._utt_first_translation_at) * 1000:.0f}"
                            if self._utt_first_translation_at is not None
                            else "?",
                        )
                        self._utt_first_audio_logged = True
                    sid = data.get("stream_id")
                    if sid in self._audio_buffers:
                        self._audio_buffers[sid].append(data)
                    else:
                        # Audio for a stream we never registered; keep it
                        # so it isn't lost.
                        self._audio_buffers[sid] = [data]
                        if sid not in self._stream_playback_order:
                            self._stream_playback_order.append(sid)
                    await self._flush_audio_in_order()
                elif data.get("terminated"):
                    # Normally `audio_end` already popped the stream from
                    # the playback queue. This branch handles cancels and
                    # errors, which terminate without an `audio_end` and
                    # would otherwise block the queue forever.
                    sid = data.get("stream_id")
                    if sid in self._stream_playback_order:
                        buffered = self._audio_buffers.get(sid, [])
                        saw_audio_end = any(c.get("audio_end") for c in buffered)
                        if not saw_audio_end:
                            self._stream_playback_order.remove(sid)
                            self._audio_buffers.pop(sid, None)
                            await self._flush_audio_in_order()
                    if sid == self._current_stream_id:
                        self._current_stream_id = None
                    # `terminated` (not `audio_end`) is what releases a
                    # Soniox quota slot.
                    if sid in self._open_tts_streams:
                        self._open_tts_streams.discard(sid)
                        self._tts_slot_available.set()
                        log.info(
                            "tts.stream.terminated id=%s open_count=%d",
                            sid,
                            len(self._open_tts_streams),
                        )
        except websockets.ConnectionClosedOK:
            pass
        except websockets.ConnectionClosed as e:
            await self.host_queue.put(
                error_message(provider=self.name, message=f"TTS recv: {e}")
            )

    async def _stt_keepalive_loop(self) -> None:
        """STT WS heartbeat. Soniox closes after ~20s of silence; we ping
        every 10s. Stops on `send_end()` so Soniox commits to finalizing."""
        try:
            while not self._draining.is_set():
                try:
                    await asyncio.wait_for(
                        self._draining.wait(), timeout=STT_KEEPALIVE_SEC
                    )
                    return  # draining now — stop pinging
                except asyncio.TimeoutError:
                    await self._stt_ws.send(json.dumps({"type": "keepalive"}))
        except websockets.ConnectionClosedOK:
            pass
        except websockets.ConnectionClosed as e:
            await self.host_queue.put(
                error_message(provider=self.name, message=f"STT keepalive: {e}")
            )

    async def _tts_keepalive_loop(self) -> None:
        try:
            while True:
                await asyncio.sleep(TTS_KEEPALIVE_SEC)
                await self._tts_ws.send(json.dumps({"keep_alive": True}))
        except websockets.ConnectionClosedOK:
            pass
        except websockets.ConnectionClosed as e:
            await self.host_queue.put(
                error_message(provider=self.name, message=f"TTS keepalive: {e}")
            )

    def _build_stt_config(self) -> dict:
        cfg = {
            "api_key": self.api_key,
            "model": STT_MODEL,
            "audio_format": self.config.common.audio_format,
            "num_channels": self.config.common.num_channels,
            "sample_rate": self.config.common.sample_rate,
            "enable_endpoint_detection": self.params.enable_endpoint_detection,
            "enable_speaker_diarization": self.params.enable_speaker_diarization,
            "enable_language_identification": self.params.enable_language_identification,
            "translation": {
                "type": "one_way",
                "target_language": self.params.target_language,
            },
        }
        # Skip the multi-second language-ID warm-up by hinting the source
        # language. Hints don't restrict detection.
        if self.params.language_hints:
            cfg["language_hints"] = self.params.language_hints
        return cfg

    def _build_tts_config(self, stream_id: str) -> dict:
        return {
            "api_key": self.api_key,
            "stream_id": stream_id,
            "model": TTS_MODEL,
            "voice": self.params.voice,
            "language": self.params.target_language,
            "audio_format": "pcm_s16le",
            "sample_rate": TTS_OUTPUT_SAMPLE_RATE,
        }

    @staticmethod
    def get_available_features() -> SupportedFeatures:
        supported = FeatureStatus.supported()
        return SupportedFeatures(
            name="Soniox",
            model=STT_MODEL,
            text_translation=supported,
            speech_to_speech=FeatureStatus.supported(
                comment=f"Translation runs on {STT_MODEL}; speech is "
                f"synthesized by {TTS_MODEL} on a separate stream.",
            ),
            source_transcript=supported,
            voice_selection=supported,
            single_multilingual_model=supported,
            language_hints=supported,
            max_language_hints=None,  # unlimited
            language_identification=supported,
            speaker_diarization=supported,
            timestamps=supported,
            endpoint_detection=supported,
        )
