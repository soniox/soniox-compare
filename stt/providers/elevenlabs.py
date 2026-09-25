import asyncio
import base64
import math
from typing import Any

from elevenlabs import (
    AudioFormat,
    CommitStrategy,
    RealtimeAudioOptions,
    RealtimeConnection,
    RealtimeEvents,
)
from elevenlabs.realtime.scribe import ScribeRealtime

from config import get_language_mapping
from providers.base import (
    BaseProvider,
    ProviderError,
)
from providers.config import ProviderConfig, FeatureStatus, SupportedFeatures
from utils import make_part

# Audio sample rates supported by ElevenLabs Scribe v2 Realtime, exposed as the
# `pcm_<rate>` audio_format. Matches the `AudioFormat` enum from the SDK.
ELEVENLABS_SUPPORTED_RATES = {8000, 16000, 22050, 24000, 44100, 48000}


class _LanguageDetectionScribe(ScribeRealtime):
    """`ScribeRealtime` that additionally sets the `include_language_detection`
    query parameter.

    The SDK (2.53.0) does not yet expose this option, so we hook into the URL
    builder to keep language identification working without re-implementing the
    websocket protocol ourselves.
    """

    def __init__(self, api_key: str, include_language_detection: bool):
        super().__init__(api_key)
        self._include_language_detection = include_language_detection

    def _build_websocket_url(self, *args: Any, **kwargs: Any) -> str:  # type: ignore[override]
        url = super()._build_websocket_url(*args, **kwargs)
        if self._include_language_detection:
            separator = "&" if "?" in url else "?"
            url = f"{url}{separator}include_language_detection=true"
        return url


class ElevenlabsProvider(BaseProvider):
    name = "elevenlabs"

    def __init__(self, config: ProviderConfig):
        super().__init__(config)
        self.config = config
        self.connection: RealtimeConnection | None = None
        # `previous_text` (context) may only be sent alongside the very first
        # audio chunk, so we track whether that chunk has gone out yet.
        self._first_chunk_sent = False
        # Set once the end-of-stream commit is requested, so the final flush
        # commit doesn't add a trailing `<end>` marker after the last words.
        self._closing = False

    async def connect(self) -> None:
        if self._is_connected:
            return

        warnings = self.validate_provider_capabilities("ElevenLabs")
        for warning in warnings:
            await self.host_queue.put(warning)

        try:
            self.error = None
            self._first_chunk_sent = False
            self._closing = False

            sample_rate = self.config.common.sample_rate
            if sample_rate not in ELEVENLABS_SUPPORTED_RATES:
                raise ProviderError(
                    f"ElevenLabs does not support a sample rate of {sample_rate} Hz."
                )

            # `vad` lets the model auto-commit transcripts on detected speech
            # boundaries, which mirrors the live, turn-by-turn behaviour of the
            # other streaming providers in this comparison.
            options: RealtimeAudioOptions = {
                "model_id": self.config.service.model,
                "audio_format": AudioFormat(f"pcm_{sample_rate}"),
                "sample_rate": sample_rate,
                "commit_strategy": CommitStrategy.VAD,
                "include_timestamps": True,
            }

            # Scribe auto-detects language when none is given. A single hint pins
            # the language. The hint list is already capped to one entry by
            # validate_provider_capabilities, which falls back to auto-detection
            # (empty list) when more than one language is requested.
            language_hints = self.config.params.language_hints
            if len(language_hints) == 1:
                mapped = get_language_mapping(self.name).get(language_hints[0])
                if mapped is not None:
                    options["language_code"] = mapped

            scribe = _LanguageDetectionScribe(
                api_key=self.config.service.api_key,
                include_language_detection=(
                    self.config.params.enable_language_identification
                ),
            )
            self.connection = await scribe.connect(options)
            self._register_handlers(self.connection)
            self._is_connected = True
        except Exception as ex:
            self.error = ProviderError(f"{ex}")
            raise self.error

    def _register_handlers(self, connection: RealtimeConnection) -> None:
        connection.on(RealtimeEvents.SESSION_STARTED, self._on_session_started)
        connection.on(RealtimeEvents.PARTIAL_TRANSCRIPT, self._on_partial_transcript)
        connection.on(
            RealtimeEvents.COMMITTED_TRANSCRIPT_WITH_TIMESTAMPS,
            self._on_committed_transcript,
        )
        connection.on(RealtimeEvents.ERROR, self._on_error)
        connection.on(RealtimeEvents.CLOSE, self._on_close)

    async def disconnect(self) -> None:
        self._end()
        if self.connection:
            try:
                await self.connection.close()
            except Exception:
                pass
            self.connection = None

    async def send(self, data: bytes | str) -> None:
        if self.error is not None:
            raise self.error
        if not self._is_connected or not self.connection:
            raise ProviderError("Not connected.")
        # The comparison only streams raw audio frames; ignore anything else.
        if not isinstance(data, bytes):
            return

        payload: dict[str, Any] = {
            "audio_base_64": base64.b64encode(data).decode("utf-8"),
        }
        if not self._first_chunk_sent:
            self._first_chunk_sent = True
            if self.config.params.context:
                payload["previous_text"] = self.config.params.context

        try:
            await self.connection.send(payload)
        except Exception as ex:
            self.error = ProviderError(f"{ex}")
            await self.disconnect()
            raise self.error

    async def send_end(self) -> None:
        # Flush any trailing audio by committing the buffered segment. Even with
        # VAD auto-commit, an explicit commit ensures the final words are
        # finalized before the stream closes.
        if not self.connection:
            return
        self._closing = True
        try:
            await self.connection.commit()
        except Exception:
            pass


    def _on_session_started(self, data: dict[str, Any]) -> None:
        self.emit_raw(data)

    def _on_partial_transcript(self, data: dict[str, Any]) -> None:
        self.emit_raw(data)
        text = data.get("text") or ""
        if text:
            self._emit_parts([make_part(text=text, is_final=False)])

    def _on_committed_transcript(self, data: dict[str, Any]) -> None:
        self.emit_raw(data)
        language = data.get("language_code")
        words = data.get("words")

        # Each committed transcript is produced by a VAD-detected speech
        # boundary, i.e. an endpoint. Mirror the other providers by appending a
        # `<end>` marker after the words. The flush triggered by the
        # end-of-stream commit is skipped so it doesn't add a trailing marker.
        emit_endpoint = (
            self.config.params.enable_endpoint_detection and not self._closing
        )

        if not words:
            text = data.get("text") or ""
            if text:
                # Trailing space so consecutive committed finals don't glue.
                text_parts = [make_part(text=text + " ", is_final=True, language=language)]
                if emit_endpoint:
                    text_parts.append(make_part(text=" <end>", is_final=True))
                self._emit_parts(text_parts)
            return

        parts: list[dict[str, Any]] = []
        for word in words:
            word_type = word.get("type", "word")
            text = word.get("text", "")
            if word_type == "spacing":
                # Attach spacing to the preceding word so timing/confidence stay
                # tied to actual words; drop leading spacing with no anchor.
                if parts:
                    parts[-1]["text"] += text
                continue

            logprob = word.get("logprob")
            confidence = math.exp(logprob) if logprob is not None else 1.0
            start = word.get("start")
            end = word.get("end")
            parts.append(
                make_part(
                    text=text,
                    is_final=True,
                    speaker=self._parse_speaker(word.get("speaker_id")),
                    language=language,
                    start_ms=int(start * 1000) if start is not None else None,
                    end_ms=int(end * 1000) if end is not None else None,
                    confidence=confidence,
                )
            )

        if parts:
            # Trailing space on the segment's last word so committed finals
            # don't glue (guarded: word spacing tokens may already add it).
            if not parts[-1]["text"].endswith(" "):
                parts[-1]["text"] += " "
            if emit_endpoint:
                last_end = parts[-1].get("end_ms")
                parts.append(
                    make_part(
                        text=" <end>",
                        is_final=True,
                        start_ms=last_end,
                        end_ms=last_end,
                    )
                )
            self._emit_parts(parts)

    @staticmethod
    def _parse_speaker(speaker_id: Any) -> int | None:
        if speaker_id is None:
            return None
        if isinstance(speaker_id, int):
            return speaker_id
        # Speaker ids look like "speaker_0"; extract the trailing integer.
        digits = "".join(ch for ch in str(speaker_id) if ch.isdigit())
        return int(digits) if digits else None

    def _emit_parts(self, parts: list[dict[str, Any]]) -> None:
        self.host_queue.put_nowait(
            {
                "type": "data",
                "provider": self.name,
                "parts": parts,
            }
        )

    def _on_error(self, data: Any) -> None:
        self.emit_raw(data)
        message = data.get("error") if isinstance(data, dict) else data
        self.error = ProviderError(str(message))
        self.host_queue.put_nowait(
            {
                "type": "error",
                "provider": self.name,
                "error_message": str(message),
            }
        )
        self._end()

    def _on_close(self) -> None:
        self._end()

    def _end(self) -> None:
        # The SDK fires CLOSE after an error and after our own close(), so this
        # runs more than once per session; only the first push ends the card.
        if self._is_connected:
            self._is_connected = False
            self.host_queue.put_nowait(None)

    @staticmethod
    def get_available_features():
        supported = FeatureStatus.supported()
        unsupported = FeatureStatus.unsupported()
        return SupportedFeatures(
            name="ElevenLabs",
            model="Scribe v2 Realtime",
            single_multilingual_model=supported,
            language_hints=supported,
            language_identification=supported,
            # Realtime Scribe does not expose speaker diarization controls.
            speaker_diarization=unsupported,
            customization=FeatureStatus.supported(
                comment="Free-form context is sent as `previous_text` with the "
                "first audio chunk to bias the transcription.",
            ),
            timestamps=supported,
            # Word-level log probabilities are returned with committed transcripts.
            confidence_scores=supported,
            real_time_latency_config=FeatureStatus.partial(
                comment="VAD commit behaviour is configurable "
                "(vad_silence_threshold_secs, vad_threshold, etc.).",
            ),
            endpoint_detection=FeatureStatus.partial(
                comment="Each transcript is committed when the server VAD "
                "detects a pause in speech, not by context-aware turn "
                "detection.",
            ),
            manual_finalization=supported,
        )
