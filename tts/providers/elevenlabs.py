from typing import AsyncIterator

from languages import get_provider_language
from providers.base import ProviderError, _require_env, _stream_post

# Keyed by provider key; every model speaks with the same pinned voice.
MODELS = {
    "elevenlabs:v4": "eleven_v4",
    "elevenlabs": "eleven_v3",
}


async def generate(
    text: str, language: str, key: str = "elevenlabs"
) -> AsyncIterator[bytes]:
    api_key = _require_env("ELEVENLABS_API_KEY")
    voice_id = "21m00Tcm4TlvDq8ikWAM"  # Rachel
    model = MODELS[key]

    elevenlabs_language = get_provider_language(language, key)
    if not elevenlabs_language:
        raise ProviderError(
            f"Language {language} is not supported by ElevenLabs ({model}) TTS"
        )

    return await _stream_post(
        f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}/stream",
        error_prefix=f"ElevenLabs ({model}) TTS error",
        headers={"xi-api-key": api_key},
        json={
            "text": text,
            "model_id": model,
            "output_format": "mp3_44100_128",
            "language_code": elevenlabs_language,
        },
    )
