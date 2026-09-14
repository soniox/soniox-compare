import os

from dotenv import load_dotenv

from providers.config import ProviderParams, ProviderConfig, ServiceConfig
from languages import LANGUAGE_MAP
from copy import deepcopy


load_dotenv()


def get_soniox_service_config():
    return ServiceConfig(
        api_key=os.environ["SONIOX_API_KEY"],
        websocket_url="wss://stt-rt.soniox.com/transcribe-websocket",
        model="stt-rt-v5",
    )


def get_speechmatics_service_config():
    return ServiceConfig(
        api_key=os.environ["SPEECHMATICS_API_KEY"],
        websocket_url="wss://eu2.rt.speechmatics.com/v2",
        model="",
    )


def get_openai_service_config():
    return ServiceConfig(
        api_key=os.environ["OPENAI_API_KEY"],
        websocket_url="wss://api.openai.com/v1/realtime",
        model="gpt-4o-transcribe",
    )


def get_cartesia_service_config():
    return ServiceConfig(
        api_key=os.environ["CARTESIA_API_KEY"],
        # Auto endpoint with native turn detection (recommended for streaming
        # without external VAD). Emits cumulative per-turn transcripts.
        websocket_url="wss://api.cartesia.ai/stt/turns/websocket",
        model="ink-2",
    )


def get_deepgram_service_config():
    return ServiceConfig(
        api_key=os.environ["DEEPGRAM_API_KEY"],
        # consider turning on smart_format=true
        websocket_url="wss://api.deepgram.com/v1/listen",
        model="nova-3",
    )


def get_assembly_service_config():
    return ServiceConfig(
        api_key=os.environ["ASSEMBLY_API_KEY"],
        websocket_url="wss://streaming.assemblyai.com/v3/ws",
        model="universal-3-5-pro",
    )


def get_elevenlabs_service_config():
    return ServiceConfig(
        api_key=os.environ["ELEVENLABS_API_KEY"],
        websocket_url="wss://api.elevenlabs.io/v1/speech-to-text/realtime",
        model="scribe_v2_realtime",
    )


def get_meta_service_config():
    return ServiceConfig(
        api_key=os.environ["META_API_KEY"],
        # The realtime endpoint authenticates in the handshake frame, so the key
        # is carried into the session rather than sent as a header.
        websocket_url="wss://api.meta.ai/v1/asr/realtime",
        model="muse-voice-transcribe-1.0",
    )


def get_smallest_service_config():
    return ServiceConfig(
        api_key=os.environ["SMALLEST_API_KEY"],
        websocket_url="wss://api.smallest.ai/waves/v1/stt/live",
        model="pulse",
    )


def get_azure_service_config():
    return ServiceConfig(
        api_key=os.environ["AZURE_API_KEY"],
        region=os.environ["AZURE_REGION"],
    )


def get_google_service_config():
    # Gemini 3.5 Transcribe Live lives on the Gemini Developer API, which takes
    # an API key — there is no service account, region or recognizer to pick as
    # there was for Cloud Speech-to-Text. The model id is owned by
    # GoogleProvider so the feature matrix and the session agree on it.
    return ServiceConfig(
        api_key=os.environ["GOOGLE_API_KEY"],
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
}


def get_provider_config(name: str, params: ProviderParams) -> ProviderConfig:
    factory = _SERVICE_CONFIG_FACTORIES.get(name)
    if factory is None:
        raise ValueError(f"Unsupported provider: {name}")
    return ProviderConfig(params=deepcopy(params), service=factory())


# Which providers appear in LANGUAGE_MAP (Soniox is omitted there — its language
# list is its own live model list, so it supports every entry).
_PROVIDERS_WITH_LANGUAGE_MAP = sorted(
    {provider for codes in LANGUAGE_MAP.values() for provider in codes}
)


def get_language_support() -> dict[str, list[str]]:
    """Supported input-language codes per provider, for the comparison UI.

    Soniox is omitted on purpose (it supports the entire rendered list).
    """
    return {
        provider: sorted(
            canon for canon, codes in LANGUAGE_MAP.items() if provider in codes
        )
        for provider in _PROVIDERS_WITH_LANGUAGE_MAP
    }


def get_language_mapping(provider_name: str) -> dict[str, str]:
    """{canonical code -> the code `provider_name` expects}, from LANGUAGE_MAP."""
    mapping = {
        canon: codes[provider_name]
        for canon, codes in LANGUAGE_MAP.items()
        if provider_name in codes
    }
    if not mapping:
        raise ValueError(f"There is no language mapping for provider: {provider_name}")
    return mapping
