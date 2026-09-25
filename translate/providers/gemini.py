import asyncio
import base64
import logging

from google import genai
from google.genai import types

from providers.base import BaseProvider
from providers.config import (
    FeatureStatus,
    ProviderConfig,
    ProviderError,
    SupportedFeatures,
)
from utils import audio_event, data_event, error_message, make_part, session_done_event
from languages import get_target_language

log = logging.getLogger("translate.gemini")

MODEL = "gemini-3.5-live-translate-preview"
# Gemini Live wants 16kHz PCM s16le mono in and emits 24kHz out.
RECEIVE_SAMPLE_RATE = 24000
# After input ends, Gemini keeps streaming audio well past the actual
# translation (trailing/runaway audio with no accompanying transcript) and
# never sends a completion signal. Real translated speech always arrives WITH
# an output transcription, so we treat the transcript stream as the source of
# truth: once no new translation transcript has arrived for this long, the
# meaningful translation is done and we finalize. Kept above the model's ~1s
# inter-transcript gap so a natural pause isn't mistaken for the end.
DRAIN_TRANSCRIPT_IDLE_SEC = 2.5
# Absolute safety cap, in case transcripts never stop.
DRAIN_MAX_SEC = 20.0


class GeminiProvider(BaseProvider):
    """A single live session handles STT, translation and TTS. The response
    modality is AUDIO, so text mode drops the inline audio parts and keeps only
    the transcription streams."""

    name = "gemini"

    def __init__(self, config: ProviderConfig):
        super().__init__(config)
        # Gemini Developer API with an API key — NOT Vertex AI like the STT/TTS
        # projects: the live-translate model's translation_config is only
        # supported in Developer API mode.
        self._client = genai.Client(api_key=config.service.api_key)
        # Set once the live session is open and ready to accept audio.
        self._ready: asyncio.Event = asyncio.Event()
        # Set on send_end(): the recv loop then waits for Gemini to flush its
        # translation backlog and go idle before emitting session_done.
        self._draining: asyncio.Event = asyncio.Event()
        self._run_task: asyncio.Task | None = None

    async def connect(self) -> None:
        if self._is_connected:
            return

        for warning in self.validate_provider_capabilities("Google"):
            await self.host_queue.put(warning)

        log.info(
            "connect model=%s sr=%d target=%s mode=%s",
            MODEL,
            self.config.common.sample_rate,
            self.params.target_language,
            self.params.mode,
        )
        self._run_task = asyncio.create_task(self._run())
        self._tasks = [self._run_task]
        # Surface a connection failure to connect() instead of hanging forever.
        ready = asyncio.create_task(self._ready.wait())
        done, _ = await asyncio.wait(
            {ready, self._run_task}, return_when=asyncio.FIRST_COMPLETED
        )
        if self._run_task in done and not self._ready.is_set():
            ready.cancel()
            # _run() finished before becoming ready -> connection error.
            exc = self._run_task.exception()
            if exc is not None:
                raise exc
            raise ProviderError("Gemini session closed before becoming ready")
        self._is_connected = True

    async def _run(self) -> None:
        """Own the live session for its whole lifetime: the SDK session object
        is only valid inside the `async with` block, so the send/recv loops run
        nested within it. Cancelling this task (the base `disconnect`) is what
        closes the session, so there is no `_close_upstream` here."""
        config = types.LiveConnectConfig(
            response_modalities=[types.Modality.AUDIO],
            translation_config=types.TranslationConfig(
                echo_target_language=True,
                target_language_code=get_target_language(
                    self.params.target_language, "gemini"
                ),
            ),
            input_audio_transcription=types.AudioTranscriptionConfig(),
            output_audio_transcription=types.AudioTranscriptionConfig(),
        )
        try:
            async with self._client.aio.live.connect(
                model=MODEL, config=config
            ) as session:
                log.info("gemini.session open")
                self._ready.set()
                async with asyncio.TaskGroup() as tg:
                    tg.create_task(self._send_loop(session))
                    tg.create_task(self._recv_loop(session))
        except asyncio.CancelledError:
            raise
        except BaseExceptionGroup as eg:
            await self._handle_session_failure(eg)
        except Exception as exc:
            await self._handle_session_failure(exc)

    async def _handle_session_failure(self, exc: BaseException) -> None:
        errors = self._flatten_exception_messages(exc)
        message = "; ".join(errors) if errors else str(exc)

        if not self._ready.is_set():
            raise ProviderError(message)

        log.warning("gemini.session error: %s", message)
        await self.host_queue.put(error_message(provider=self.name, message=message))
        await self.host_queue.put(session_done_event(provider=self.name))

    @staticmethod
    def _flatten_exception_messages(exc: BaseException) -> list[str]:
        if isinstance(exc, BaseExceptionGroup):
            messages: list[str] = []
            for sub_exc in exc.exceptions:
                messages.extend(GeminiProvider._flatten_exception_messages(sub_exc))
            return messages
        return [str(exc)]

    async def _send_loop(self, session) -> None:
        mime_type = f"audio/pcm;rate={self.config.common.sample_rate}"
        while True:
            kind, payload = await self._audio_queue.get()
            if kind == "audio":
                await session.send_realtime_input(
                    audio=types.Blob(data=payload, mime_type=mime_type)
                )
            elif kind == "end":
                # Tell Gemini the audio input is over so it finalizes the
                # current turn and flushes its remaining translation. We do NOT
                # emit session_done here: Gemini lags several seconds behind, so
                # the recv loop waits for it to actually go idle first.
                log.info("gemini.input_end -> audio_stream_end, draining")
                await session.send_realtime_input(audio_stream_end=True)
                self._draining.set()
                return

    async def _recv_loop(self, session) -> None:
        # `session.receive()` yields one turn's worth of messages and then the
        # iterator ends; we re-enter it to keep listening across turns. We drive
        # the iterator manually (rather than `async for`) so that, once input has
        # ended, we can put a timeout on the wait and declare the session done
        # when Gemini falls silent — it lags several seconds behind, so a fixed
        # post-input delay would truncate the tail of the translation.
        speaks = self.emits_audio
        source_language = (
            self.params.language_hints[0] if self.params.language_hints else None
        )
        drain_started: float | None = None
        last_transcript_at: float | None = None
        stream = session.receive().__aiter__()
        while not self._stopped:
            if self._draining.is_set():
                now = asyncio.get_event_loop().time()
                if drain_started is None:
                    drain_started = now
                    last_transcript_at = now
                if now - last_transcript_at > DRAIN_TRANSCRIPT_IDLE_SEC:
                    # Translation transcripts have stopped; the remaining audio
                    # is trailing/runaway output. We're done.
                    log.info(
                        "gemini.drain transcript-idle (%.1fs) -> session_done",
                        now - last_transcript_at,
                    )
                    await self.host_queue.put(session_done_event(provider=self.name))
                    return
                if now - drain_started > DRAIN_MAX_SEC:
                    log.info("gemini.drain max cap -> session_done")
                    await self.host_queue.put(session_done_event(provider=self.name))
                    return

            try:
                # Cap the wait so the transcript-idle check above runs even if
                # no message arrives at all (true silence).
                timeout = (
                    DRAIN_TRANSCRIPT_IDLE_SEC if self._draining.is_set() else None
                )
                response = await asyncio.wait_for(stream.__anext__(), timeout=timeout)
            except StopAsyncIteration:
                # Turn ended — start the next receive iterator.
                stream = session.receive().__aiter__()
                continue
            except asyncio.TimeoutError:
                # Draining and nothing arrived for the whole window -> done.
                log.info("gemini.drain idle -> session_done")
                await self.host_queue.put(session_done_event(provider=self.name))
                return

            if response.go_away is not None:
                log.warning(
                    "gemini.go_away time_left=%s",
                    getattr(response.go_away, "time_left", None),
                )

            server_content = response.server_content
            if not server_content:
                continue

            parts: list[dict] = []

            if speaks and server_content.model_turn:
                for p in server_content.model_turn.parts:
                    inline = p.inline_data
                    if inline and isinstance(inline.data, bytes):
                        await self.host_queue.put(
                            audio_event(
                                provider=self.name,
                                pcm_b64=base64.b64encode(inline.data).decode("ascii"),
                                sample_rate=RECEIVE_SAMPLE_RATE,
                            )
                        )

            in_tx = server_content.input_transcription
            if in_tx and in_tx.text:
                parts.append(
                    make_part(
                        text=in_tx.text,
                        is_final=True,
                        translation_status="original",
                        language=in_tx.language_code or source_language,
                        source_language=in_tx.language_code or source_language,
                    )
                )

            out_tx = server_content.output_transcription
            if out_tx and out_tx.text:
                last_transcript_at = asyncio.get_event_loop().time()
                parts.append(
                    make_part(
                        text=out_tx.text,
                        is_final=True,
                        translation_status="translation",
                        language=out_tx.language_code or self.params.target_language,
                        source_language=source_language,
                    )
                )

            if parts:
                await self.host_queue.put(data_event(provider=self.name, parts=parts))
            if self._draining.is_set() and (
                server_content.generation_complete or server_content.turn_complete
            ):
                log.info(
                    "gemini.drain complete (gen=%s turn=%s) -> session_done",
                    server_content.generation_complete,
                    server_content.turn_complete,
                )
                await self.host_queue.put(session_done_event(provider=self.name))
                return

    @staticmethod
    def get_available_features() -> SupportedFeatures:
        supported = FeatureStatus.supported()
        unsupported = FeatureStatus.unsupported()
        return SupportedFeatures(
            name="Google",
            model=MODEL,
            text_translation=supported,
            speech_to_speech=supported,
            source_transcript=supported,
            voice_selection=FeatureStatus.unsupported(
                comment="The model echoes the speaker's own voice in the "
                "target language and exposes no voice selection.",
            ),
            single_multilingual_model=supported,
            language_hints=FeatureStatus.unsupported(
                comment="Gemini auto-detects the source language and accepts "
                "no hints.",
            ),
            language_identification=FeatureStatus.partial(
                comment="The source language is auto-detected and reported "
                "per transcript, but cannot be constrained.",
            ),
            speaker_diarization=unsupported,
            timestamps=unsupported,
            endpoint_detection=unsupported,
        )
