import asyncio
import json
import re
import traceback
from typing import Any

import websockets

from providers.base import (
    BaseProvider,
    ProviderError,
)
from providers.config import ProviderConfig, SupportedFeatures, FeatureStatus
from utils import make_part, info_message
from config import get_language_mapping


# The realtime endpoint expects the handshake within 10 seconds of the socket
# opening and answers with `{"sessionId": ...}` before any event frame.
HANDSHAKE_TIMEOUT_SEC = 10.0

# Muse Voice Transcribe pins the session to one mode; the playground's
# diarization and endpoint-detection toggles are independent, so the mode is
# derived in `_resolve_mode` with endpoint detection taking precedence.
MODE_PUSH_TO_TALK = "PUSH_TO_TALK"
MODE_ENDPOINTING = "ENDPOINTING"
MODE_DIARIZATION = "DIARIZATION"


class MetaProvider(BaseProvider):
    name = "meta"

    def __init__(self, config: ProviderConfig):
        super().__init__(config)
        self.config = config
        self.websocket: websockets.ClientConnection | None = None
        self.client_queue: asyncio.Queue[bytes | str] = asyncio.Queue(maxsize=100)
        self._sender: asyncio.Task[Any] | None = None
        self._receiver: asyncio.Task[Any] | None = None
        self._mode = MODE_PUSH_TO_TALK
        # Set once `endStream` has been queued. The server rejects audio after
        # end-of-input, so anything the client sends afterwards is dropped, and
        # the flush turn it produces must not add a trailing `<end>` marker.
        self._closing = False
        # Turns can overlap: a later turn can open before an earlier turn's
        # `speechComplete` arrives, so boundaries and speaker labels are kept
        # per `turnId` rather than in a single "current turn" slot.
        self._turns: dict[int, dict[str, Any]] = {}
        # `transcript` and `speaker` events carry no turnId — they belong to the
        # turn opened by the most recent `speechStart`.
        self._active_turn: int | None = None
        # Session-scoped `"A"`/`"B"` labels mapped to the 1-indexed speaker
        # numbers the other providers report.
        self._speaker_numbers: dict[str, int] = {}
        # Concatenated turns need exactly one space between them. Meta usually
        # pads its turn transcripts already, so `_separator` looks at both sides
        # rather than always inserting one.
        self._has_final_text = False
        self._final_ends_with_space = False

    def _resolve_mode(self) -> str:
        if self.config.params.enable_endpoint_detection:
            return MODE_ENDPOINTING
        if self.config.params.enable_speaker_diarization:
            return MODE_DIARIZATION
        return MODE_PUSH_TO_TALK

    async def _language_bias(self) -> list[str]:
        """`languageBias` takes language names, e.g. `["English", "French"]`.

        The hint only steers recognition, and Meta covers 25 of the languages
        the comparison offers, so hints it does not cover are dropped with a
        warning. Failing the session would lose the languages it does support —
        this mirrors the clamp-and-warn `validate_capabilities` already applies
        to `max_language_hints`.
        """
        hints = self.config.params.language_hints
        if not hints:
            return []  # no hint → the model detects the language itself
        mapping = get_language_mapping("meta")
        names: list[str] = []
        unsupported: list[str] = []
        for hint in hints:
            name = mapping.get(hint)
            if name is None:
                unsupported.append(hint)
            elif name not in names:
                names.append(name)

        if unsupported:
            fallback = (
                f"biasing toward {', '.join(names)} only"
                if names
                else "falling back to automatic language detection"
            )
            await self.host_queue.put(
                info_message(
                    "Meta",
                    f"Meta does not support {', '.join(unsupported)}; {fallback}.",
                    level="warning",
                )
            )
        return names

    def _keywords(self) -> list[str]:
        """Biasing terms derived from the shared free-text context field.

        `keywords` wants discrete terms rather than prose, so the context is
        split on the separators a user would naturally type.
        """
        raw = self.config.params.context
        if not raw:
            return []
        terms: list[str] = []
        for chunk in re.split(r"[\n,;]+", raw):
            term = chunk.strip()
            if term and term not in terms:
                terms.append(term)
        return terms

    def _join(self, text: str) -> str:
        """`text` with exactly one space separating it from what came before.

        Meta pads its turn transcripts with its own leading and trailing spaces,
        so the seam is normalized rather than always given another separator.
        """
        if not self._has_final_text:
            return text.lstrip()
        leading = text[:1].isspace()
        if self._final_ends_with_space:
            return text.lstrip() if leading else text
        return text if leading else " " + text

    def _note_final_text(self, text: str) -> None:
        self._has_final_text = True
        self._final_ends_with_space = text[-1:].isspace()

    def _speaker_number(self, label: str) -> int:
        if label not in self._speaker_numbers:
            self._speaker_numbers[label] = len(self._speaker_numbers) + 1
        return self._speaker_numbers[label]

    async def connect(self) -> None:
        if self._is_connected:
            return

        for warning in self.validate_provider_capabilities("Meta"):
            await self.host_queue.put(warning)

        try:
            self.error = None
            self._closing = False
            self._has_final_text = False
            self._final_ends_with_space = False
            self._turns = {}
            self._active_turn = None
            self._speaker_numbers = {}

            self._mode = self._resolve_mode()
            # Speaker labels only exist in DIARIZATION, which the endpointing
            # request has already claimed. Say so instead of silently dropping
            # them from the transcript.
            if (
                self._mode == MODE_ENDPOINTING
                and self.config.params.enable_speaker_diarization
            ):
                self.config.params.enable_speaker_diarization = False
                await self.host_queue.put(
                    info_message(
                        "Meta",
                        "Meta transcribes in a single mode per session, and speaker "
                        "diarization and endpoint detection live in different ones. "
                        "Endpoint detection was requested, so diarization has been "
                        "disabled for this session.",
                        level="warning",
                    )
                )

            if not self.config.service.api_key:
                raise ProviderError("META_API_KEY is not set.")

            self.websocket = await websockets.connect(
                self.config.service.websocket_url
            )

            # The credential travels in the handshake; the realtime endpoint
            # ignores the HTTP Authorization header.
            handshake: dict[str, Any] = {
                "authorization": {
                    "accessToken": f"Bearer {self.config.service.api_key}"
                },
                # 16 kHz s16le mono matches the session's common audio format, so
                # nothing needs resampling. The model's native rate is 24 kHz, but
                # upsampling here would not recover detail the source never had.
                "audioEncoding": "PCM_16KHZ",
                "model": self.config.service.model,
                "mode": self._mode,
                # Each partial supersedes the previous one, which is what the
                # frontend expects: non-final parts are replaced on every event.
                "partialMode": "CUMULATIVE",
                "emitAudioProgress": False,
            }
            language_bias = await self._language_bias()
            if language_bias:
                handshake["languageBias"] = language_bias
            keywords = self._keywords()
            if keywords:
                handshake["keywords"] = keywords

            await self.websocket.send(json.dumps(handshake))

            # Wait for the acknowledgement before streaming. The ack is the only
            # server frame without a `type`; a rejected handshake answers with an
            # error event instead, which carries a sessionId too — so the `type`
            # is what distinguishes them, not the presence of an id.
            ack_raw = await asyncio.wait_for(
                self.websocket.recv(), HANDSHAKE_TIMEOUT_SEC
            )
            self.emit_raw(ack_raw)
            ack = json.loads(ack_raw)
            if ack.get("type") is not None or "sessionId" not in ack:
                raise ProviderError(
                    ack.get("message") or f"Handshake failed: {ack}"
                )

            self._is_connected = True
            self._sender = asyncio.create_task(self._send_loop())
            self._receiver = asyncio.create_task(self._recv_loop())
        except Exception as ex:
            self.error = ex
            # A rejected handshake or ack timeout leaves the socket open, and
            # `connect()` raising means nothing else will disconnect it. Meta
            # caps a tenant at 8 concurrent streams, so release it here rather
            # than waiting for the server's idle timeout to reclaim the slot.
            if self.websocket:
                try:
                    await self.websocket.close()
                except Exception:
                    pass
                self.websocket = None
            raise ProviderError(f"{ex}")

    async def disconnect(self) -> None:
        self._is_connected = False
        self.host_queue.put_nowait(None)
        if self._sender:
            self._sender.cancel()
        if self._receiver:
            self._receiver.cancel()
        if self.websocket:
            await self.websocket.close()

    async def send(self, data: bytes | str) -> None:
        if self.error is not None:
            raise self.error
        if not self._is_connected:
            raise ProviderError("Not connected.")
        if self._closing:
            return  # end-of-input already sent; the server would reject more audio
        try:
            self.client_queue.put_nowait(data)
        except asyncio.QueueFull:
            self.error = ProviderError("Queue full: disconnecting.")
            await self.disconnect()
            raise self.error

    async def send_end(self) -> None:
        # `endStream` half-closes the client-to-server direction and leaves the
        # socket open so the server can flush pending results before closing
        # with 1000. Closing the socket instead can discard those events.
        if not self.websocket or self._closing:
            return
        self._closing = True
        end_msg = json.dumps({"type": "endStream"})
        try:
            self.client_queue.put_nowait(end_msg)
        except asyncio.QueueFull:
            # Without end-of-input the server never flushes the last turn, so
            # finalizing matters more than the tail of the audio: drop the oldest
            # queued chunk to make room. Nothing runs between these two calls, so
            # the freed slot cannot be taken by another sender.
            self.client_queue.get_nowait()
            self.client_queue.put_nowait(end_msg)

    async def _send_loop(self):
        while self._is_connected:
            msg = await self.client_queue.get()
            if not self.websocket:
                break
            try:
                await self.websocket.send(msg)
            except Exception as ex:
                self.error = ex
                await self._handle_error(f"Sender error: {ex}")
                break

    async def _recv_loop(self):
        try:
            async for resp in self.websocket:
                if isinstance(resp, bytes):
                    continue
                self.emit_raw(resp)
                event = json.loads(resp)
                event_type = event.get("type")

                if event_type == "transcript":
                    await self._on_transcript(event)
                elif event_type == "speechStart":
                    turn_id = event.get("turnId")
                    self._turns[turn_id] = {
                        "start_ms": event.get("audioProcessedMs"),
                        "end_ms": None,
                        "speaker": None,
                    }
                    self._active_turn = turn_id
                elif event_type == "speaker":
                    # The label covers the span back to the most recent
                    # `speechStart`, and the event carries no turnId, so that is
                    # the turn it belongs to. Turns can overlap: if a later turn
                    # opens before an earlier one has been labelled, the earlier
                    # turn stays `speaker=None` — the protocol carries nothing to
                    # recover it with. A turn gets one label, so the latest wins.
                    if self._active_turn in self._turns:
                        self._turns[self._active_turn]["speaker"] = (
                            self._speaker_number(event["label"])
                        )
                elif event_type == "speechEnd":
                    # A boundary, not the transcript — that arrives in
                    # `speechComplete`, which may post-process the turn.
                    turn = self._turns.get(event.get("turnId"))
                    if turn is not None:
                        turn["end_ms"] = event.get("audioProcessedMs")
                elif event_type == "speechComplete":
                    await self._on_speech_complete(event)
                elif event_type == "error":
                    await self._handle_error(event.get("message", "Unknown error"))
                    break
                # `audioProgress` is switched off in the handshake, and unknown
                # event types are ignored so additive server events don't break
                # the session.
        except Exception as ex:
            self.error = ex
            await self._handle_error(f"Receiver error: {ex}")

    async def _on_transcript(self, event: dict[str, Any]) -> None:
        transcript = event.get("transcript", "")
        if not transcript:
            return

        is_final = event.get("final") is True
        if is_final and self._mode != MODE_PUSH_TO_TALK:
            # In the multi-turn modes `speechComplete` owns turn completion, and
            # this event closes out the stream instead — its text is already in
            # the turns we emitted (in practice it arrives empty).
            return

        turn = self._turns.get(self._active_turn, {})
        # The speaker label can still be missing here: in DIARIZATION it arrives
        # partway through the turn, and the final part carries the settled value.
        speaker = turn.get("speaker")

        transcript = self._join(transcript)
        if is_final:
            self._note_final_text(transcript)

        await self._emit_parts(
            [
                make_part(
                    text=transcript,
                    is_final=is_final,
                    speaker=speaker,
                    language=None,
                    start_ms=turn.get("start_ms"),
                    end_ms=event.get("audioProcessedMs"),
                    confidence=None,
                )
            ]
        )

    async def _on_speech_complete(self, event: dict[str, Any]) -> None:
        turn_id = event.get("turnId")
        turn = self._turns.pop(turn_id, {})
        if self._active_turn == turn_id:
            self._active_turn = None

        transcript = event.get("transcript", "")
        parts: list[dict[str, Any]] = []
        if transcript:
            transcript = self._join(transcript)
            # `speechEnd` is the turn's boundary, but a turn the stream ended
            # part-way through never gets one.
            end_ms = turn.get("end_ms")
            if end_ms is None:
                end_ms = event.get("audioProcessedMs")
            parts.append(
                make_part(
                    text=transcript,
                    is_final=True,
                    speaker=turn.get("speaker"),
                    language=None,
                    start_ms=turn.get("start_ms"),
                    end_ms=end_ms,
                    confidence=None,
                )
            )
            self._note_final_text(transcript)

        # Mark the model's detected endpoint the way the other providers do, but
        # skip the flush turn produced by the explicit `endStream`.
        if (
            parts
            and self.config.params.enable_endpoint_detection
            and not self._closing
        ):
            marker = self._join("<end>")
            parts.append(make_part(text=marker, is_final=True, confidence=None))
            self._note_final_text(marker)

        if parts:
            await self._emit_parts(parts)

    async def _emit_parts(self, parts: list[dict[str, Any]]) -> None:
        await self.host_queue.put(
            {
                "type": "data",
                "provider": self.name,
                "parts": parts,
            }
        )

    async def _handle_error(self, ex):
        traceback.print_exc()
        await self.host_queue.put(
            {
                "type": "error",
                "provider": self.name,
                "error_message": str(ex),
            }
        )
        await self.disconnect()

    @staticmethod
    def get_available_features():
        supported = FeatureStatus.supported()
        unsupported = FeatureStatus.unsupported()
        return SupportedFeatures(
            name="Meta",
            model="muse-voice-transcribe-1.0",
            # 25 languages with code-switching.
            single_multilingual_model=supported,
            # `languageBias` is a list of language names with no documented cap.
            language_hints=supported,
            max_language_hints=None,
            # The model detects the language itself but never reports which one
            # it settled on, so there is nothing to surface per token.
            language_identification=unsupported,
            speaker_diarization=FeatureStatus.partial(
                comment="Runs in the model's DIARIZATION mode, which Meta does "
                "not tune for low latency and which cannot be combined with "
                "endpoint detection."
            ),
            customization=supported,  # keyword biasing
            # Turn-level boundaries only: https://dev.meta.ai/docs/speech-to-text
            timestamps=FeatureStatus.partial(
                comment="Turn-level timestamps only; the model does not return "
                "word-level timestamps."
            ),
            confidence_scores=unsupported,
            real_time_latency_config=unsupported,
            # ENDPOINTING mode: the model finds the edges of each utterance.
            endpoint_detection=FeatureStatus.supported(
                comment="The model detects speech turn boundaries natively and "
                "emits one finalized transcript per turn."
            ),
            # The realtime session has no client-side turn commit; `endStream`
            # ends the whole session rather than one turn.
            manual_finalization=unsupported,
        )
