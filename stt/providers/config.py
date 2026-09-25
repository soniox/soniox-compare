from pydantic import BaseModel, Field
from enum import Enum


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


class ProviderOption(BaseModel):
    """A vendor request parameter with no cross-provider equivalent.

    `default` is what this app sends when the user changes nothing, so declaring
    an option is never a change in behaviour, and its type decides the control
    the frontend renders. `comment` says what we send, not what the vendor's
    docs call it; it renders next to the control.

    Every option defaults to OFF: nothing is switched on until the user asks for
    it, so the grid starts from one baseline. Note that off does not always mean
    "least processed" — xAI's `filler_words` off lets it strip "uh"/"um", while
    google.py pins VERBATIM mode in code and keeps them.
    """

    default: bool | int | float | str
    comment: str = ""


class SupportedFeatures(BaseModel):
    name: str
    model: str
    single_multilingual_model: FeatureStatus
    language_hints: FeatureStatus
    # Max number of explicit language hints the provider's streaming API accepts.
    # None = unlimited. When the request exceeds this, validate_capabilities falls
    # back to auto-detection (if single_multilingual_model is supported) or keeps
    # the first N hints otherwise.
    max_language_hints: int | None = 1
    # Whether the provider's auto-detect mode covers every language it accepts
    # as a hint. Deepgram's `multi` mode covers 10 of its 54, so dropping the
    # hints there can land outside the requested language entirely.
    auto_detect_covers_all_languages: bool = True
    language_identification: FeatureStatus
    speaker_diarization: FeatureStatus
    customization: FeatureStatus
    timestamps: FeatureStatus
    confidence_scores: FeatureStatus
    real_time_latency_config: FeatureStatus
    endpoint_detection: FeatureStatus
    manual_finalization: FeatureStatus
    # Vendor request parameters, keyed by the vendor's own parameter name.
    options: dict[str, ProviderOption] = {}
    # Most providers punctuate and capitalize unconditionally, so the default
    # says so; the ones with a switch we actually send override it.
    text_formatting: FeatureStatus = FeatureStatus(
        state=FeatureState.PARTIAL,
        comment="Always formatted; this provider exposes no switch, so the "
        "setting has no effect.",
    )


class ProviderError(Exception):
    """Base error for all provider-related exceptions."""

    def __init__(self, message, code=None, details=None):
        self.message = message
        self.code = code
        self.details = details
        super().__init__(message)


class ProviderData(BaseModel):
    name: str
    supported_features: SupportedFeatures


class CommonConfig(BaseModel):
    audio_format: str = "pcm_s16le"
    sample_rate: int = 16000
    num_channels: int = 1


COMMON_CFG = CommonConfig()


class ServiceConfig(BaseModel):
    # Not all parameters are used by all services. This can be specialized later.
    api_key: str = ""
    websocket_url: str = ""
    model: str = ""
    region: str = ""
    prompt: str = ""


class ProviderParams(BaseModel):
    language_hints: list[str] = []
    context: str = ""
    enable_speaker_diarization: bool = True
    enable_language_identification: bool = True
    enable_endpoint_detection: bool = False
    # Overrides for the per-provider options above. validate_capabilities fills
    # in every declared key before a provider reads this, so provider code can
    # index it directly rather than restating the default.
    options: dict[str, bool | int | float | str] = {}


class ProviderConfig(BaseModel):
    params: ProviderParams
    service: ServiceConfig
    common: CommonConfig = Field(default=COMMON_CFG, init=False)
