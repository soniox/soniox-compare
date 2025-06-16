import os

from dotenv import load_dotenv

from providers.config import ProviderParams, ProviderConfig, ServiceConfig
import json
from copy import deepcopy
from pathlib import Path


load_dotenv()


def get_soniox_service_config():
    return ServiceConfig(
        provider_name="soniox",
        api_key=os.environ["SONIOX_API_KEY"],
        websocket_url="wss://stt-rt.soniox.com/transcribe-websocket",
        model="stt-rt-preview",
    )


def get_speechmatics_service_config():
    return ServiceConfig(
        provider_name="speechmatics",
        api_key=os.environ["SPEECHMATICS_API_KEY"],
        websocket_url="wss://eu2.rt.speechmatics.com/v2",
        model="",
    )


def get_openai_service_config(params: ProviderParams):

    prompt = ""

    if params.mode == "mt":
        assert (
            params.translation is not None
        ), "Translation requested, but target language not set."
        target_translation_language = params.translation.target_language
        prompt = (
            f"Translate everything to language ISO 639 {target_translation_language}."
            + f" Do not output {params.translation.source_languages[0]}. You need to translate."
        )

    return ServiceConfig(
        provider_name="openai",
        api_key=os.environ["OPENAI_API_KEY"],
        websocket_url="wss://api.openai.com/v1/realtime",
        model="gpt-4o-transcribe",
        prompt=prompt,
    )


def get_deepgram_service_config():
    return ServiceConfig(
        provider_name="deepgram",
        api_key=os.environ["DEEPGRAM_API_KEY"],
        # consider turning on smart_format=true
        websocket_url="wss://api.deepgram.com/v1/listen",
        model="nova-3",
    )


def get_assemblyai_service_config():
    return ServiceConfig(
        provider_name="assembly",
        api_key=os.environ["ASSEMBLY_API_KEY"],
        websocket_url="wss://streaming.assemblyai.com/v3/ws",
        model="",
    )


def get_azure_service_config():
    return ServiceConfig(
        provider_name="azure",
        api_key=os.environ["AZURE_API_KEY"],
        region=os.environ["AZURE_REGION"],
    )


def get_google_service_config():
    cfg = ServiceConfig(
        provider_name="google",
        model="chirp_2",
        region="global",
        recognizer_id="_",
    )

    credentials_fn = "./credentials-google.json"
    os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = credentials_fn

    with open(credentials_fn, "r") as f:
        credentials_data = json.load(f)
        cfg.project_id = credentials_data.get("project_id", cfg.project_id)
        if not cfg.project_id:
            raise ValueError(
                "project_id not found in credentials file and not set in GoogleConfig."
            )

    if cfg.recognizer_id == "_Default":
        print(
            "WARN: GoogleConfig.recognizer_id was 'Default', correcting to '_'."
            " Using default ad-hoc recognizer."
        )
        cfg.recognizer_id = "_"
    elif cfg.recognizer_id == "_":
        print(
            "INFO: GoogleConfig.recognizer_id is '_'. Using default ad-hoc recognizer "
            f"in region '{cfg.region}'. Ensure config details (model, language, "
            "audio format) are appropriate."
        )
    else:
        print(
            f"INFO: GoogleConfig.recognizer_id is '{cfg.recognizer_id}'. "
            f"Using specific recognizer in region '{cfg.region}'."
        )
    return cfg


def get_provider_config(name: str, params: ProviderParams) -> ProviderConfig:
    if name == "soniox":
        service_cfg = get_soniox_service_config()

    elif name == "google":
        service_cfg = get_google_service_config()

    elif name == "speechmatics":
        service_cfg = get_speechmatics_service_config()

    elif name == "deepgram":
        service_cfg = get_deepgram_service_config()

    elif name == "azure":
        service_cfg = get_azure_service_config()

    elif name == "assembly":
        service_cfg = get_assemblyai_service_config()

    elif name == "openai":
        service_cfg = get_openai_service_config(params)
    else:
        raise ValueError(f"Unsupported provider: {name}")

    return ProviderConfig(params=deepcopy(params), service=service_cfg)


def _load_language_mapping(mapping_file: str):
    with open(mapping_file, 'r') as file:
        return json.load(file)


file_dir = str(Path(__file__).resolve().parent)

__GOOGLE_LANG_MAPPING = _load_language_mapping(f"{file_dir}/transcription_languages/google.json")
__AZURE_LANG_MAPPING = _load_language_mapping(f"{file_dir}/transcription_languages/azure.json")
__SPEECHMATICS_LANG_MAPPING = _load_language_mapping(
    f"{file_dir}/transcription_languages/speechmatics.json"
)
__DEEPGRAM_LANG_MAPPING = _load_language_mapping(
    f"{file_dir}/transcription_languages/deepgram.json"
)
__ASSEMBLY_LANG_MAPPING = _load_language_mapping(
    f"{file_dir}/transcription_languages/assemblyai.json"
)


def get_language_mapping(provider_name: str) -> dict[str, str]:

    if provider_name == "google":
        return __GOOGLE_LANG_MAPPING

    elif provider_name == "azure":
        return __AZURE_LANG_MAPPING

    elif provider_name == "speechmatics":
        return __SPEECHMATICS_LANG_MAPPING

    elif provider_name == "deepgram":
        return __DEEPGRAM_LANG_MAPPING

    elif provider_name == "assembly":
        return __ASSEMBLY_LANG_MAPPING

    else:
        raise ValueError(f"There is no language mapping for provider: {provider_name}")


__AZURE_TRANSLATION_LANG_MAPPING = _load_language_mapping(
    f"{file_dir}/translation_languages/azure.json"
)

__GOOGLE_TRANSLATION_LANG_MAPPING = _load_language_mapping(
    f"{file_dir}/translation_languages/google.json"
)

__SPEECHMATICS_TRANSLATION_LANG_MAPPING = _load_language_mapping(
     f"{file_dir}/translation_languages/speechmatics.json"
)


def get_translation_language_mapping(provider_name: str):

    if provider_name == "azure":
        return __AZURE_TRANSLATION_LANG_MAPPING
    if provider_name == "google":
        return __GOOGLE_TRANSLATION_LANG_MAPPING
    elif provider_name == "speechmatics":
        return __SPEECHMATICS_TRANSLATION_LANG_MAPPING
    else:
        raise ValueError(
            f"There is no language mapping translation for: {provider_name}."
        )
