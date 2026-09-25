from typing import AsyncIterator

from languages import get_provider_language
from providers.base import ProviderError, _require_env, _stream_post

# Keyed by provider key, since the voice is tied to the model pool.
MODELS = {
    "smallest": {"model": "lightning_v3.1", "voice_id": "magnus"},
    "smallest:pro": {"model": "lightning_v3.1_pro", "voice_id": "meher"},
}


async def generate(
    text: str, language: str, key: str = "smallest"
) -> AsyncIterator[bytes]:
    api_key = _require_env("SMALLEST_API_KEY")
    model = MODELS[key]

    smallest_language = get_provider_language(language, key)
    if not smallest_language:
        raise ProviderError(
            f"Language {language} is not supported by Smallest AI "
            f"({model['model']}) TTS"
        )

    return await _stream_post(
        "https://api.smallest.ai/waves/v1/tts",
        error_prefix=f"Smallest AI ({model['model']}) TTS error",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Accept": "audio/mpeg",
        },
        json={
            "text": text,
            "voice_id": model["voice_id"],
            "model": model["model"],
            "language": smallest_language,
            "sample_rate": 44100,
            "output_format": "mp3",
        },
    )
