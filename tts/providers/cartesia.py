from typing import AsyncIterator

from languages import get_provider_language
from providers.base import _require_env, _stream_post


async def generate(text: str, language: str) -> AsyncIterator[bytes]:
    api_key = _require_env("CARTESIA_API_KEY")

    body: dict = {
        "model_id": "sonic-3.6",
        "transcript": text,
        "voice": {
            "mode": "id",
            "id": "6ccbfb76-1fc6-48f7-b71d-91ac6298247b",  # Tessa
        },
        "output_format": {
            "container": "mp3",
            "sample_rate": 44100,
            "bit_rate": 128000,
        },
        "speed": "normal",
        "generation_config": {"speed": 1, "volume": 1},
    }
    provider_language = get_provider_language(language, "cartesia")
    if provider_language:
        body["language"] = provider_language

    return await _stream_post(
        "https://api.cartesia.ai/tts/bytes",
        error_prefix="Cartesia TTS error",
        headers={"Cartesia-Version": "2025-04-16", "X-API-Key": api_key},
        json=body,
    )
