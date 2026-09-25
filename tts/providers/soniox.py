import os
from typing import AsyncIterator

from providers.base import _require_env, _stream_post


async def generate(text: str, language: str) -> AsyncIterator[bytes]:
    api_key = _require_env("SONIOX_API_KEY")
    tts_host = os.getenv("SONIOX_TTS_HOST", "https://tts-rt.soniox.com")

    return await _stream_post(
        f"{tts_host}/tts",
        error_prefix="Soniox TTS error",
        headers={"Authorization": f"Bearer {api_key}"},
        json={
            "model": "tts-rt-v2",
            "language": language,
            "voice": "Hazel",
            "audio_format": "mp3",
            "text": text,
        },
    )
