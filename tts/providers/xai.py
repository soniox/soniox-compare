from typing import AsyncIterator

from languages import get_provider_language
from providers.base import ProviderError, _require_env, _stream_post


async def generate(text: str, language: str) -> AsyncIterator[bytes]:
    api_key = _require_env("XAI_API_KEY")

    xai_language = get_provider_language(language, "xai")
    if not xai_language:
        raise ProviderError(f"Language {language} is not supported by xAI TTS")

    return await _stream_post(
        "https://api.x.ai/v1/tts",
        error_prefix="xAI TTS error",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json={
            "text": text,
            "voice_id": "eve",
            "language": xai_language,
            "output_format": {
                "codec": "mp3",
                "sample_rate": 44100,
                "bit_rate": 128000,
            },
        },
    )
