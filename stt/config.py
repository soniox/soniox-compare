import os

from dotenv import load_dotenv

from providers.config import ProviderConfig, ProviderError, ProviderParams, ServiceConfig
from languages import LANGUAGE_MAP
from copy import deepcopy


load_dotenv()

_CRED_ENV = {
    "soniox": "SONIOX_API_KEY",
    "speechmatics": "SPEECHMATICS_API_KEY",
    "openai": "OPENAI_API_KEY",
    "cartesia": "CARTESIA_API_KEY",
    "deepgram": "DEEPGRAM_API_KEY",
    "assembly": "ASSEMBLY_API_KEY",
    "elevenlabs": "ELEVENLABS_API_KEY",
    "meta": "META_API_KEY",
    "smallest": "SMALLEST_API_KEY",
    "inworld": "INWORLD_API_KEY",
    "xai": "XAI_API_KEY",
    "azure": "AZURE_API_KEY",
    "google": "GOOGLE_API_KEY",
}


def _require_key(provider: str) -> str:
    """A missing key is a provider-level failure, not a server crash: the WS
    endpoint surfaces it on that provider's card and the others keep running."""
    env_var = _CRED_ENV[provider]
    key = os.environ.get(env_var)
    if not key:
        raise ProviderError(f"{env_var} is not set in the environment.")
    return key


def get_soniox_service_config():
    return ServiceConfig(
        api_key=_require_key("soniox"),
        websocket_url="wss://stt-rt.soniox.com/transcribe-websocket",
        model="stt-rt-v5",
    )


def get_speechmatics_service_config():
    return ServiceConfig(
        api_key=_require_key("speechmatics"),
        websocket_url="wss://eu2.rt.speechmatics.com/v2",
        model="",
    )


def get_openai_service_config():
    return ServiceConfig(
        api_key=_require_key("openai"),
        websocket_url="wss://api.openai.com/v1/realtime",
        model="gpt-4o-transcribe",
    )


def get_cartesia_service_config():
    return ServiceConfig(
        api_key=_require_key("cartesia"),
        # Auto endpoint with native turn detection (recommended for streaming
        # without external VAD). Emits cumulative per-turn transcripts.
        websocket_url="wss://api.cartesia.ai/stt/turns/websocket",
        model="ink-2",
    )


def get_deepgram_service_config():
    return ServiceConfig(
        api_key=_require_key("deepgram"),
        websocket_url="wss://api.deepgram.com/v1/listen",
        model="nova-3",
    )


def get_openai_whisper_service_config():
    config = get_openai_service_config()
    config.model = "gpt-realtime-whisper"
    return config


def get_assembly_service_config():
    return ServiceConfig(
        api_key=_require_key("assembly"),
        websocket_url="wss://streaming.assemblyai.com/v3/ws",
        model="universal-3-5-pro",
    )


def get_assembly_streaming_service_config():
    return ServiceConfig(
        api_key=_require_key("assembly"),
        websocket_url="wss://streaming.assemblyai.com/v3/ws",
        model="universal-streaming-multilingual",
    )


def get_elevenlabs_service_config():
    return ServiceConfig(
        api_key=_require_key("elevenlabs"),
        websocket_url="wss://api.elevenlabs.io/v1/speech-to-text/realtime",
        model="scribe_v2_realtime",
    )


def get_meta_service_config():
    return ServiceConfig(
        api_key=_require_key("meta"),
        # The realtime endpoint authenticates in the handshake frame, so the key
        # is carried into the session rather than sent as a header.
        websocket_url="wss://api.meta.ai/v1/asr/realtime",
        model="muse-voice-transcribe-1.0",
    )


def get_smallest_service_config():
    return ServiceConfig(
        api_key=_require_key("smallest"),
        websocket_url="wss://api.smallest.ai/waves/v1/stt/live",
        model="pulse",
    )


def get_inworld_service_config():
    return ServiceConfig(
        api_key=_require_key("inworld"),
        websocket_url="wss://api.inworld.ai/stt/v1/transcribe:streamBidirectional",
        model="inworld/inworld-stt-1",
    )


def get_xai_service_config():
    return ServiceConfig(
        api_key=_require_key("xai"),
        websocket_url="wss://api.x.ai/v1/stt",
        model="grok-voice-transcribe-2.0",
    )


def get_azure_service_config():
    return ServiceConfig(
        api_key=_require_key("azure"),
        # AzureProvider reports a missing region on its card.
        region=os.environ.get("AZURE_REGION", ""),
    )


def get_google_service_config():
    # Gemini 3.5 Transcribe Live lives on the Gemini Developer API, which takes
    # an API key — there is no service account, region or recognizer to pick as
    # there was for Cloud Speech-to-Text. The model id is owned by
    # GoogleProvider so the feature matrix and the session agree on it.
    return ServiceConfig(
        api_key=_require_key("google"),
    )


_SERVICE_CONFIG_FACTORIES = {
    "soniox": get_soniox_service_config,
    "google": get_google_service_config,
    "speechmatics": get_speechmatics_service_config,
    "deepgram": get_deepgram_service_config,
    "cartesia": get_cartesia_service_config,
    "azure": get_azure_service_config,
    "assembly": get_assembly_service_config,
    "openai": get_openai_service_config,
    "elevenlabs": get_elevenlabs_service_config,
    "meta": get_meta_service_config,
    "smallest": get_smallest_service_config,
    "xai": get_xai_service_config,
    "inworld": get_inworld_service_config,
    "assembly:streaming": get_assembly_streaming_service_config,
    "openai:whisper": get_openai_whisper_service_config,
}


def get_provider_config(name: str, params: ProviderParams) -> ProviderConfig:
    factory = _SERVICE_CONFIG_FACTORIES.get(name)
    if factory is None:
        raise ValueError(f"Unsupported provider: {name}")
    return ProviderConfig(params=deepcopy(params), service=factory())


def get_supported_languages() -> list[str]:
    """Every language at least one provider supports, which is what the
    selector offers. The union, not any single provider's list."""
    return sorted(LANGUAGE_MAP)


def get_language_support(provider_names) -> dict[str, list[str]]:
    """Supported input-language codes per provider, for the comparison UI.

    Takes the registered provider keys rather than reading them off
    LANGUAGE_MAP, so a `provider:model` key that inherits its base provider's
    languages is listed too.
    """
    support = {}
    for name in provider_names:
        try:
            support[name] = sorted(get_language_mapping(name))
        except ValueError:
            # A provider that takes no language parameter has no table.
            continue
    return support


def unsupported_language(provider_name: str, language_hints: list[str]) -> str | None:
    """The first requested language this provider does not support, if any.

    Most providers accept an unknown language code without complaining and then
    transcribe as something else, which reads as a bad transcript rather than
    an unsupported language. Checking here turns that into a clear message.
    """
    if not language_hints:
        return None
    try:
        mapping = get_language_mapping(provider_name)
    except ValueError:
        # No language table: the provider takes no language parameter.
        return None
    for hint in language_hints:
        if hint not in mapping:
            return hint
    return None


def get_language_mapping(provider_name: str) -> dict[str, str]:
    """{canonical code -> the code `provider_name` expects}, from LANGUAGE_MAP.

    A further model of a provider ("openai:mini") shares the provider's table
    unless it has entries of its own, which it needs when it covers a different
    set of languages than the provider's default model.
    """
    mapping = {
        canon: codes[provider_name]
        for canon, codes in LANGUAGE_MAP.items()
        if provider_name in codes
    }
    if not mapping:
        base = provider_name.split(":")[0]
        mapping = {
            canon: codes[base] for canon, codes in LANGUAGE_MAP.items() if base in codes
        }
    if not mapping:
        raise ValueError(f"There is no language mapping for provider: {provider_name}")
    return mapping
