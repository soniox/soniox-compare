from typing import AsyncIterator

from providers.base import _require_env, _stream_post


async def generate(text: str, language: str) -> AsyncIterator[bytes]:
    api_key = _require_env("FISH_API_KEY")
    voice_id = "933563129e564b19a115bedd57b7406a"  # Sarah

    return await _stream_post(
        "https://api.fish.audio/v1/tts",
        error_prefix="Fish Audio TTS error",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "model": "s2.1-pro",
        },
        json={
            "text": text,
            "reference_id": voice_id,
            "format": "mp3",
            "mp3_bitrate": 128,
            "sample_rate": 44100,
            "latency": "balanced",
        },
    )
