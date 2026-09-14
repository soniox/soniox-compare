from typing import AsyncIterator

from languages import get_provider_language
from providers.base import ProviderError, _require_env, _stream_post


async def generate(text: str, language: str) -> AsyncIterator[bytes]:
    api_key = _require_env("SMALLEST_API_KEY")

    smallest_language = get_provider_language(language, "smallest_pro")
    if not smallest_language:
        raise ProviderError(
            f"Language {language} is not supported by Smallest AI (Lightning v3.1 Pro) TTS"
        )

    return await _stream_post(
        "https://api.smallest.ai/waves/v1/tts",
        error_prefix="Smallest AI (Lightning v3.1 Pro) TTS error",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Accept": "audio/mpeg",
        },
        json={
            "text": text,
            "voice_id": "meher",
            "model": "lightning_v3.1_pro",
            "language": smallest_language,
            "sample_rate": 44100,
            "output_format": "mp3",
        },
    )
