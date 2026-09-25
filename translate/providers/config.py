from enum import Enum
from typing import Any, Literal

from pydantic import BaseModel, Field


class ProviderError(Exception):
    """Base error for all provider-related exceptions."""

    def __init__(self, message: str, code: str | None = None, details: Any = None):
        self.message = message
        self.code = code
        self.details = details
        super().__init__(message)


class FeatureState(Enum):
    SUPPORTED = "SUPPORTED"
    UNSUPPORTED = "UNSUPPORTED"
    PARTIAL = "PARTIAL"


class FeatureStatus(BaseModel):
    state: FeatureState
    comment: str = ""

    @staticmethod
    def supported(comment=""):
        return FeatureStatus(state=FeatureState.SUPPORTED, comment=comment)

    @staticmethod
    def unsupported(comment=""):
        return FeatureStatus(state=FeatureState.UNSUPPORTED, comment=comment)

    @staticmethod
    def partial(comment=""):
        return FeatureStatus(state=FeatureState.PARTIAL, comment=comment)


# Which output the session produces. "text" runs speech -> translated text only;
# "s2s" additionally streams synthesized speech in the target language back to
# the browser. Providers advertise support for each via SupportedFeatures.
Mode = Literal["text", "s2s"]


class SupportedFeatures(BaseModel):
    name: str
    model: str

    # Speech -> translated text. A provider without this can't take part in the
    # comparison at all, and its tile renders greyed out in the picker.
    text_translation: FeatureStatus
    # Speech -> translated speech. Gates selectability in s2s mode.
    speech_to_speech: FeatureStatus
    # Whether the provider also emits the *source* transcript alongside the
    # translation. Without it, a card renders only the translated side.
    source_transcript: FeatureStatus
    # Whether the TTS voice can be chosen. Providers with a fixed server voice
    # report UNSUPPORTED and the voice picker is hidden for them.
    voice_selection: FeatureStatus

    single_multilingual_model: FeatureStatus
    language_hints: FeatureStatus
    # Max number of explicit source-language hints the provider's streaming API
    # accepts. None = unlimited. When the request exceeds this,
    # validate_capabilities falls back to auto-detection (if
    # single_multilingual_model is supported) or keeps the first N otherwise.
    max_language_hints: int | None = 1
    language_identification: FeatureStatus
    speaker_diarization: FeatureStatus
    timestamps: FeatureStatus
    endpoint_detection: FeatureStatus


class CommonConfig(BaseModel):
    audio_format: str = "pcm_s16le"
    # The browser captures at one rate and the backend fans that single stream
    # out to every provider, so providers needing another rate resample on
    # ingest (see providers/audio.py).
    sample_rate: int = 16000
    num_channels: int = 1


COMMON_CFG = CommonConfig()

# Every provider that speaks emits PCM at this rate.
TTS_OUTPUT_SAMPLE_RATE = 24000


class ServiceConfig(BaseModel):
    # Not all parameters are used by all services. Model ids live on each
    # provider module, since the feature matrix needs them at class level.
    api_key: str = ""
    websocket_url: str = ""
    tts_websocket_url: str = ""
    region: str = ""


class ProviderParams(BaseModel):
    mode: Mode = "text"
    target_language: str = "es"
    voice: str = ""
    language_hints: list[str] = []
    enable_speaker_diarization: bool = True
    enable_language_identification: bool = True
    enable_endpoint_detection: bool = True


class ProviderConfig(BaseModel):
    params: ProviderParams
    service: ServiceConfig
    common: CommonConfig = Field(default=COMMON_CFG, init=False)
