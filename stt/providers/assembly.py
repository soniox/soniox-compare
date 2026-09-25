import asyncio
from typing import Any, AsyncIterator

from assemblyai.streaming.v3 import (  # type: ignore[import-untyped]
    AsyncStreamingClient,
    BeginEvent,
    StreamingClientOptions,
    StreamingError,
    StreamingEvents,
    StreamingParameters,
    TerminationEvent,
    TurnEvent,
)
from assemblyai.streaming.v3.models import (  # type: ignore[import-untyped]
    Encoding,
    SpeechModel,
)

from config import get_language_mapping
from providers.base import (
    BaseProvider,
    ProviderError,
)
from providers.config import (
    FeatureStatus,
    ProviderConfig,
    ProviderOption,
    SupportedFeatures,
)
from utils import make_part

# Sentinel pushed onto the audio queue to end the streaming generator cleanly.
_STREAM_END = object()
# Sentinel pushed onto the audio queue to force the current turn to end. Routed
# through the same queue as audio so it is ordered strictly after all buffered
# audio chunks (a direct `force_endpoint()` call can otherwise overtake audio
# that is still queued, finalizing the turn early and orphaning the last words).
_FORCE_ENDPOINT = object()


class AssemblyProvider(BaseProvider):
    name = "assembly"

    def __init__(self, config: ProviderConfig):
        super().__init__(config)
        self.client: AsyncStreamingClient | None = None
        self.client_queue: asyncio.Queue[Any] = asyncio.Queue(maxsize=100)
        self._stream_task: asyncio.Task[Any] | None = None

    async def connect(self) -> None:
        if self._is_connected:
            return

        warnings = self.validate_provider_capabilities("AssemblyAI")
        for warning in warnings:
            await self.host_queue.put(warning)

        try:
            params = StreamingParameters(
                sample_rate=self.config.common.sample_rate,
                encoding=Encoding.pcm_s16le,
                speech_model=SpeechModel(self.config.service.model),
                # Emit partials continuously (not only on pauses) so the live
                # transcript tracks the audio closely. Without this, a long
                # turn shows almost nothing until it finalizes, and the tail of
                # the stream can appear stuck on a stale partial.
                continuous_partials=True,
            )

            # Only the streaming model declares `format_turns`, so the default
            # here stands for "this model does not expose it" rather than
            # restating a declared value: Universal-3.5 Pro is formatted
            # whatever it is set to.
            if self.config.params.options.get("format_turns", False):
                params.format_turns = True

            # Universal-3.5 Pro returns `language_code`/`language_confidence` on
            # Turn events only when language detection is enabled.
            if self.config.params.enable_language_identification:
                params.language_detection = True

            # Real-time speaker diarization (public beta): adds a turn-level
            # `speaker_label` and a per-word `speaker` field.
            if self.config.params.enable_speaker_diarization:
                params.speaker_labels = True

            # The model natively code-switches; a single hint can bias it toward
            # one language (best-effort). With no hint we rely on code-switching.
            language_hints = self.config.params.language_hints
            if len(language_hints) == 1:
                lang_mapping = get_language_mapping(self.name)
                mapped = lang_mapping.get(language_hints[0])
                if mapped is not None:
                    params.language_code = mapped

            self.client = AsyncStreamingClient(
                StreamingClientOptions(api_key=self.config.service.api_key)
            )
            self.client.on(StreamingEvents.Begin, self._on_begin)
            self.client.on(StreamingEvents.Turn, self._on_turn)
            self.client.on(StreamingEvents.Termination, self._on_terminated)
            self.client.on(StreamingEvents.Error, self._on_error)

            await self.client.connect(params)
            self._is_connected = True
            self._stream_task = asyncio.create_task(
                self.client.stream(self._audio_gen())
            )
        except Exception as ex:
            self.error = ex
            raise ProviderError(f"Connection failed: {ex}")

    async def disconnect(self) -> None:
        if not self._is_connected and self.client is None:
            return
        self._is_connected = False
        self.host_queue.put_nowait(None)
        # Unblock the audio generator so `stream()` can finish.
        try:
            self.client_queue.put_nowait(_STREAM_END)
        except asyncio.QueueFull:
            pass
        if self.client is not None:
            try:
                await self.client.disconnect(terminate=True)
            except Exception:
                pass
        if self._stream_task is not None:
            self._stream_task.cancel()
            self._stream_task = None

    async def send(self, data: bytes | str) -> None:
        if self.error is not None:
            raise self.error
        if not self._is_connected:
            raise ProviderError("Not connected.")
        if not isinstance(data, bytes):
            return
        try:
            self.client_queue.put_nowait(data)
        except asyncio.QueueFull:
            await self.disconnect()
            raise ProviderError("Queue full: disconnecting.")

    async def send_end(self) -> None:
        # Flush the in-progress turn so its final transcript is emitted before
        # the socket drains and closes. The force-endpoint is queued behind any
        # buffered audio (see `_FORCE_ENDPOINT`) so the last words aren't lost.
        if not self._is_connected:
            return
        try:
            await self.client_queue.put(_FORCE_ENDPOINT)
        except Exception:
            pass


    async def _audio_gen(self) -> AsyncIterator[bytes]:
        while self._is_connected:
            chunk = await self.client_queue.get()
            if chunk is _STREAM_END:
                return
            if chunk is _FORCE_ENDPOINT:
                # All audio enqueued before this sentinel has already been
                # handed to `client.stream()`, so the forced endpoint lands
                # after it on the wire.
                if self.client is not None:
                    try:
                        await self.client.force_endpoint()
                    except Exception:
                        pass
                continue
            if isinstance(chunk, bytes):
                yield chunk

    @staticmethod
    def _map_speaker(label: Any) -> int | None:
        # AssemblyAI emits letter labels ("A", "B", ...) or "UNKNOWN". Map them
        # to 1-indexed speaker numbers ("A" -> 1) to match the other providers
        # (e.g. Soniox) and the frontend renderer, which is 1-indexed and treats
        # a speaker value of 0 as "no speaker".
        if not isinstance(label, str) or len(label) != 1 or not label.isalpha():
            return None
        return ord(label.upper()) - ord("A") + 1

    async def _on_turn(self, _client: AsyncStreamingClient, event: TurnEvent) -> None:
        self.emit_raw(event)
        is_final = event.end_of_turn

        parts = []
        for word in event.words:
            speaker = self._map_speaker(word.speaker)
            if speaker is None:
                speaker = self._map_speaker(event.speaker_label)
            parts.append(
                make_part(
                    text=word.text + " ",
                    start_ms=word.start,
                    end_ms=word.end,
                    confidence=word.confidence,
                    is_final=is_final,
                    language=event.language_code,
                    speaker=speaker,
                )
            )

        if is_final and self.config.params.enable_endpoint_detection:
            last_end = parts[-1]["end_ms"] if parts else None
            parts.append(
                make_part(
                    text=" <end>",
                    is_final=True,
                    start_ms=last_end,
                    end_ms=last_end,
                    confidence=event.end_of_turn_confidence,
                )
            )

        if not parts:
            return

        await self.host_queue.put(
            {
                "type": "data",
                "provider": self.name,
                "parts": parts,
            }
        )

    async def _on_begin(self, _client: AsyncStreamingClient, event: BeginEvent) -> None:
        self.emit_raw(event)

    async def _on_terminated(
        self, _client: AsyncStreamingClient, event: TerminationEvent
    ) -> None:
        self.emit_raw(event)

    async def _on_error(
        self, _client: AsyncStreamingClient, error: StreamingError
    ) -> None:
        self.emit_raw(error)
        self.error = error
        await self._handle_error(error)

    async def _handle_error(self, ex: Exception) -> None:
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
        # Universal-3.5 Pro Streaming (preview):
        # https://www.assemblyai.com/docs/streaming/select-the-speech-model
        supported = FeatureStatus.supported()

        return SupportedFeatures(
            name="AssemblyAI",
            model="Universal-3.5 Pro",
            # Native code-switching across 19 languages in a single model.
            single_multilingual_model=supported,
            # `language_code` biases the model best-effort; the model otherwise
            # auto-detects and code-switches, so a hint may be ignored.
            language_hints=FeatureStatus.partial(
                comment="The model auto-detects and code-switches between "
                "languages. A single language hint biases the model "
                "(best-effort) and may be ignored.",
            ),
            # `language_detection` returns `language_code`/`language_confidence`
            # on Turn events.
            language_identification=supported,
            # Real-time speaker diarization via `speaker_labels` (public beta).
            speaker_diarization=FeatureStatus.supported(
                comment="Real-time speaker diarization (public beta). Short "
                "turns may be labeled UNKNOWN until enough audio accumulates.",
            ),
            # The API takes `keyterms_prompt`; the context is not sent here.
            customization=supported,
            timestamps=supported,
            confidence_scores=supported,
            # The turn-silence parameters are not sent; the SDK defaults apply.
            real_time_latency_config=FeatureStatus.partial(
                comment="Use an audio chunk size of 50ms. Larger chunk sizes "
                "are workable, but may result in latency fluctuations.",
            ),
            # End-of-turn detection is native to Universal-3.5 Pro.
            endpoint_detection=supported,
            # `force_endpoint()` ends the current turn on demand.
            manual_finalization=supported,
            text_formatting=FeatureStatus.partial(
                comment="Universal-3.5 Pro is formatted whatever `format_turns` "
                "is set to, so the setting has no effect on this model.",
            ),
        )


class AssemblyStreamingProvider(AssemblyProvider):
    """The cheaper streaming tier. Same socket and SDK, six languages instead
    of nineteen, and it returns unformatted text — no casing, no punctuation."""

    name = "assembly:streaming"

    @staticmethod
    def get_available_features():
        features = AssemblyProvider.get_available_features()
        features.model = "universal-streaming-multilingual"
        features.options = {
            "format_turns": ProviderOption(
                default=False,
                comment="Punctuation and casing on each finished turn; this "
                "model returns neither without it.",
            )
        }
        features.text_formatting = FeatureStatus.supported(
            comment="`format_turns` adds punctuation and casing when the "
            "setting is on; without it this model returns neither.",
        )
        return features
