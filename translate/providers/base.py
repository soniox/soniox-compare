import asyncio
from abc import ABC, abstractmethod
from typing import Any, ClassVar

from providers.config import (
    FeatureState,
    ProviderConfig,
    ProviderError,
    SupportedFeatures,
)
from utils import info_message

# How long `receive()` waits for a first event before reporting "nothing yet",
# so the per-provider forward task in main.py stays responsive to cancellation.
RECEIVE_TIMEOUT_SEC = 0.1


class BaseProvider(ABC):
    """Abstract base class for all speech-translation providers.

    Providers push normalized events (see utils.py) onto `host_queue`, which
    `main.py` drains via `receive()` and forwards to the browser. A provider
    signals it has nothing left to say by pushing `None`.
    """

    name: ClassVar[str]  # subclasses override: name = "soniox" etc.

    def __init__(self, config: ProviderConfig):
        self.config = config
        self.host_queue: asyncio.Queue[dict[str, Any] | None] = asyncio.Queue()
        self._is_connected = False
        self._tasks: list[asyncio.Task] = []
        self._stopped = False
        # ("audio", pcm) or ("end", None), drained by the provider's send loop.
        self._audio_queue: asyncio.Queue[tuple[str, bytes | None]] = asyncio.Queue()

    @property
    def params(self):
        return self.config.params

    @property
    def service(self):
        return self.config.service

    @property
    def emits_audio(self) -> bool:
        """Whether this session should synthesize speech at all."""
        return self.config.params.mode == "s2s"

    def is_connected(self) -> bool:
        return self._is_connected

    def validate_provider_capabilities(self, label: str) -> list[dict[str, Any]]:
        """Reconcile the requested config against what this provider can do.

        Mutates `self.config.params` to disable unsupported features and returns
        warnings to surface on the provider's card. Raises ProviderError for
        fatal incompatibilities.
        """
        return validate_capabilities(self.get_available_features(), self.config, label)

    async def receive(self) -> list[dict[str, Any]]:
        """Drain everything currently queued, blocking briefly for the first item.

        A `None` in the queue is the provider's end-of-life sentinel: mark the
        provider disconnected and return whatever preceded it.
        """
        try:
            first = await asyncio.wait_for(
                self.host_queue.get(), timeout=RECEIVE_TIMEOUT_SEC
            )
        except asyncio.TimeoutError:
            return []

        items: list[dict[str, Any]] = []
        item: dict[str, Any] | None = first
        while True:
            if item is None:
                self._is_connected = False
                return items
            items.append(item)
            if self.host_queue.empty():
                return items
            item = self.host_queue.get_nowait()

    @abstractmethod
    async def connect(self) -> None:
        """Establish the upstream connection. Returns when ready for audio."""
        ...

    async def disconnect(self) -> None:
        """Stop every task, release the upstream connection and push the `None`
        sentinel that ends `receive()`. Idempotent."""
        if self._stopped:
            return
        self._stopped = True
        self._is_connected = False
        for t in self._tasks:
            t.cancel()
        await asyncio.gather(*self._tasks, return_exceptions=True)
        try:
            await self._close_upstream()
        except Exception:
            # The session is over either way; the sentinel below must still go.
            pass
        await self.host_queue.put(None)

    async def _close_upstream(self) -> None:
        """Release the upstream connection after every task has been cancelled.
        Providers whose connection dies with their task need not override."""

    async def send(self, data: bytes) -> None:
        """Push one PCM chunk (16 kHz s16le mono) to the provider."""
        await self._audio_queue.put(("audio", data))

    async def send_end(self) -> None:
        """Signal no more audio will arrive — finish the current utterance."""
        await self._audio_queue.put(("end", None))

    @staticmethod
    @abstractmethod
    def get_available_features() -> SupportedFeatures:
        """Static capability declaration, surfaced in the comparison UI."""
        ...

    @classmethod
    async def list_voices(cls, api_key: str | None = None) -> list[dict]:
        """TTS voices this provider offers. Fixed-voice providers return one."""
        return [{"id": "default", "name": "(default)"}]


def validate_capabilities(
    features: SupportedFeatures, config: ProviderConfig, provider: str
) -> list[dict[str, Any]]:
    warnings: list[dict[str, Any]] = []
    params = config.params

    # Mode support is fatal, not a downgrade: the frontend greys these tiles
    # out, so reaching here means the request was hand-crafted or the roster
    # changed under an already-open tab.
    if params.mode == "s2s":
        if features.speech_to_speech.state == FeatureState.UNSUPPORTED:
            raise ProviderError(
                features.speech_to_speech.comment
                or f"{provider} does not support speech-to-speech translation."
            )
    elif features.text_translation.state == FeatureState.UNSUPPORTED:
        raise ProviderError(
            features.text_translation.comment
            or f"{provider} does not support speech translation."
        )

    if features.source_transcript.state == FeatureState.UNSUPPORTED:
        warnings.append(
            info_message(
                provider,
                features.source_transcript.comment
                or "This provider does not emit a transcript of the source "
                "audio, so only the translated text is shown.",
                level="info",
            )
        )

    if params.mode == "s2s" and params.voice:
        if features.voice_selection.state == FeatureState.UNSUPPORTED:
            warnings.append(
                info_message(
                    provider,
                    features.voice_selection.comment
                    or "This provider uses a fixed voice; the selected voice "
                    "was ignored.",
                    level="info",
                )
            )
            params.voice = ""

    # Cap source-language hints to what the provider's streaming API accepts.
    # When the request exceeds the max, prefer automatic detection (if the
    # model supports it) over silently picking a subset.
    max_hints = features.max_language_hints
    hints = params.language_hints
    if max_hints is not None and len(hints) > max_hints:
        supports_auto = (
            features.single_multilingual_model.state == FeatureState.SUPPORTED
        )
        if supports_auto:
            warnings.append(
                info_message(
                    provider,
                    f"This provider accepts at most {max_hints} language "
                    "hint(s); falling back to automatic language detection.",
                    level="warning",
                )
            )
            params.language_hints = []
        else:
            warnings.append(
                info_message(
                    provider,
                    f"This provider accepts at most {max_hints} language "
                    f"hint(s); using the first {max_hints} and ignoring the "
                    "rest.",
                    level="warning",
                )
            )
            params.language_hints = hints[:max_hints]

    for flag, status, label in (
        (
            "enable_speaker_diarization",
            features.speaker_diarization,
            "Speaker diarization",
        ),
        (
            "enable_language_identification",
            features.language_identification,
            "Language identification",
        ),
        (
            "enable_endpoint_detection",
            features.endpoint_detection,
            "Endpoint detection",
        ),
    ):
        if not getattr(params, flag):
            continue
        if status.state == FeatureState.UNSUPPORTED:
            warnings.append(
                info_message(
                    provider,
                    f"{label} is not supported by this provider and has been "
                    "disabled.",
                    level="warning",
                )
            )
            setattr(params, flag, False)
        elif status.state == FeatureState.PARTIAL:
            warnings.append(
                info_message(
                    provider,
                    status.comment or f"{label} is partially supported.",
                    level="info",
                )
            )

    return warnings
