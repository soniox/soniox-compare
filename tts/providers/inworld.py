import base64
import json
from typing import AsyncIterator

from providers.base import ProviderError, _client, _require_env


async def generate(text: str, language: str) -> AsyncIterator[bytes]:
    api_key = _require_env("INWORLD_API_KEY")

    request = _client.build_request(
        "POST",
        "https://api.inworld.ai/tts/v1/voice:stream",
        headers={"Authorization": f"Basic {api_key}"},
        json={
            "text": text,
            "voiceId": "Ashley",
            "modelId": "inworld-tts-2",
            "audioConfig": {
                "audioEncoding": "MP3",
                "sampleRateHertz": 48000,
                "bitRate": 128000,
            },
        },
    )
    response = await _client.send(request, stream=True)
    if response.status_code != 200:
        message = (await response.aread()).decode("utf-8", errors="replace")
        await response.aclose()
        raise ProviderError(f"Inworld TTS error: {message or response.reason_phrase}")

    # Each NDJSON line carries the next base64 slice of one continuous MP3
    # stream; the body ends with a blank line.
    async def stream() -> AsyncIterator[bytes]:
        try:
            async for line in response.aiter_lines():
                if line.strip():
                    event = json.loads(line)
                    yield base64.b64decode(event["result"]["audioContent"])
        finally:
            await response.aclose()

    return stream()
