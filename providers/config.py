from pydantic import BaseModel, Field
from enum import Enum
from typing import Literal

OperationMode = Literal["stt", "mt"]

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


class SupportedFeatures(BaseModel):
    name: str
    model: str
    single_multilingual_model: FeatureStatus
    language_hints: FeatureStatus
    language_identification: FeatureStatus
    speaker_diarization: FeatureStatus
    customization: FeatureStatus
    timestamps: FeatureStatus
    confidence_scores: FeatureStatus
    translation_one_way: FeatureStatus
    translation_two_way: FeatureStatus
    real_time_latency_config: FeatureStatus
    endpoint_detection: FeatureStatus
    manual_finalization: FeatureStatus


class ProviderData(BaseModel):
    name: str
    supported_features: SupportedFeatures


class TranslationConfig(BaseModel):
    target_language: str = "en"  # Only used for one_way translation
    source_languages: list[str] = ["*"]  # Only used for one_way translation
    language_a: str | None = None  # Only used for two_way translation
    language_b: str | None = None  # Only used for two_way translation
    type: str = "one_way"


class CommonConfig(BaseModel):
    audio_format: str = "pcm_s16le"
    sample_rate: int = 16000
    num_channels: int = 1


COMMON_CFG = CommonConfig()


class ServiceConfig(BaseModel):
    # Not all parameters are used by all services. This can be specialized later.
    provider_name: str
    api_key: str = ""
    websocket_url: str = ""
    model: str = ""
    credentials_fn: str = ""
    region: str = ""
    project_id: str = ""
    prompt: str = ""
    recognizer_id: str = ""


class ProviderParams(BaseModel):
    mode: OperationMode = "stt"
    language_hints: list[str] = []
    context: str = ""
    enable_speaker_diarization: bool = True
    enable_language_identification: bool = True
    enable_endpoint_detection: bool = True
    translation: TranslationConfig | None = Field(default_factory=TranslationConfig)


class ProviderConfig(BaseModel):
    params: ProviderParams
    service: ServiceConfig
    common: CommonConfig = Field(default=COMMON_CFG, init=False)
