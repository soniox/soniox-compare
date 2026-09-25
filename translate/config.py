import os
from copy import deepcopy

from dotenv import load_dotenv

from providers.config import ProviderConfig, ProviderError, ProviderParams, ServiceConfig

load_dotenv()

_CRED_ENV: dict[str, str] = {
    "soniox": "SONIOX_API_KEY",
    "openai": "OPENAI_API_KEY",
    "gemini": "GOOGLE_API_KEY",
    "speechmatics": "SPEECHMATICS_API_KEY",
    "azure": "AZURE_API_KEY",
}


def _require_key(provider: str) -> str:
    """A missing key is a provider-level failure, not a server crash: the WS
    endpoint surfaces it on that provider's card and the others keep running."""
    env_var = _CRED_ENV[provider]
    key = os.environ.get(env_var)
    if not key:
        raise ProviderError(f"{env_var} is not set in the environment.")
    return key


def get_soniox_service_config() -> ServiceConfig:
    return ServiceConfig(
        api_key=_require_key("soniox"),
        websocket_url="wss://stt-rt.soniox.com/transcribe-websocket",
        tts_websocket_url="wss://tts-rt.soniox.com/tts-websocket",
    )


def get_openai_service_config() -> ServiceConfig:
    return ServiceConfig(
        api_key=_require_key("openai"),
        websocket_url="wss://api.openai.com/v1/realtime/translations",
    )


def get_gemini_service_config() -> ServiceConfig:
    """Unlike the STT/TTS projects (Vertex AI service account), this uses the
    Gemini Developer API with an API key: the live-translate model's
    translation_config is not supported in Vertex AI mode."""
    return ServiceConfig(api_key=_require_key("gemini"))


def get_speechmatics_service_config() -> ServiceConfig:
    return ServiceConfig(
        api_key=_require_key("speechmatics"),
        websocket_url="wss://eu2.rt.speechmatics.com/v2",
    )


def get_azure_service_config() -> ServiceConfig:
    region = os.environ.get("AZURE_REGION", "")
    return ServiceConfig(api_key=_require_key("azure"), region=region)


_SERVICE_CONFIG_FACTORIES = {
    "soniox": get_soniox_service_config,
    "openai": get_openai_service_config,
    "gemini": get_gemini_service_config,
    "speechmatics": get_speechmatics_service_config,
    "azure": get_azure_service_config,
}


def get_provider_config(name: str, params: ProviderParams) -> ProviderConfig:
    factory = _SERVICE_CONFIG_FACTORIES.get(name)
    if factory is None:
        raise ValueError(f"Unsupported provider: {name}")
    return ProviderConfig(params=deepcopy(params), service=factory())


def get_credentials(name: str) -> str | None:
    """API key for the REST endpoints (voices/languages). Unlike `_require_key`
    this returns None rather than raising, so those routes degrade instead of
    500-ing when a provider is unconfigured."""
    env_var = _CRED_ENV.get(name)
    return os.environ.get(env_var) if env_var else None
