import asyncio
import base64
import json
import os
from typing import AsyncIterator

import lameenc
from google.auth.transport.requests import Request as GoogleAuthRequest
from google.oauth2 import service_account

from languages import get_provider_language
from providers.base import ProviderError, _client, _require_env, _stream_post

# Keyed by provider key. Cloud TTS rejects these models, so they go through the
# Gemini API with the plain API key instead of the service account.
GEMINI_MODELS = {
    "google:3.8-flash": "gemini-3.8-flash-tts",
    "google:3.8-flash-lite": "gemini-3.8-flash-lite-tts",
    "google:3.1-flash": "gemini-3.1-flash-tts-preview",
}


async def generate(text: str, language: str) -> AsyncIterator[bytes]:
    google_language = get_provider_language(language, "google")
    if not google_language:
        raise ProviderError(f"Language {language} is not supported by Google TTS")

    credentials_base64 = os.getenv("GOOGLE_CREDENTIALS_JSON_BASE64")
    if credentials_base64:
        credentials_info = json.loads(base64.b64decode(credentials_base64))
    elif os.path.exists("credentials-google.json"):
        with open("credentials-google.json") as f:
            credentials_info = json.load(f)
    else:
        raise ProviderError(
            "Google credentials not found: set GOOGLE_CREDENTIALS_JSON_BASE64 or "
            "provide credentials-google.json"
        )

    credentials = service_account.Credentials.from_service_account_info(
        credentials_info, scopes=["https://www.googleapis.com/auth/cloud-platform"]
    )
    # google-auth's token refresh is synchronous; keep it off the event loop.
    await asyncio.to_thread(credentials.refresh, GoogleAuthRequest())

    # Google's REST API returns base64 JSON, not an audio stream, so the full
    # clip is buffered before the first byte reaches the client.
    response = await _client.post(
        "https://texttospeech.googleapis.com/v1/text:synthesize",
        headers={"Authorization": f"Bearer {credentials.token}"},
        json={
            "input": {"text": text},
            "voice": {
                "languageCode": google_language,
                "name": "Kore",
                "modelName": "gemini-2.5-flash-tts",
            },
            "audioConfig": {"audioEncoding": "MP3"},
        },
    )
    if response.status_code != 200:
        raise ProviderError(f"Google TTS error: {response.text}")

    audio_content = response.json().get("audioContent")
    if not audio_content:
        raise ProviderError("Google TTS response missing audio content")
    audio = base64.b64decode(audio_content)

    async def stream() -> AsyncIterator[bytes]:
        yield audio

    return stream()


async def generate_gemini(text: str, language: str, key: str) -> AsyncIterator[bytes]:
    api_key = _require_env("GOOGLE_API_KEY")

    model = GEMINI_MODELS[key]
    # The Gemini API takes no language code and reads it off the text; the
    # mapping only gates which languages we offer.
    if not get_provider_language(language, key):
        raise ProviderError(f"Language {language} is not supported by Google TTS ({model})")

    response = await _stream_post(
        f"https://generativelanguage.googleapis.com/v1beta/models/{model}:streamGenerateContent?alt=sse",
        error_prefix=f"Google TTS ({model}) error",
        headers={"x-goog-api-key": api_key},
        json={
            "contents": [{"parts": [{"text": text}]}],
            "generationConfig": {
                "responseModalities": ["AUDIO"],
                "speechConfig": {
                    "voiceConfig": {"prebuiltVoiceConfig": {"voiceName": "Kore"}}
                },
            },
        },
    )

    # Each SSE event carries the next slice of one headerless 24 kHz mono PCM
    # stream (all three models, unlike their non-streaming responses). The
    # Gemini API has no compressed output for TTS, so the PCM is encoded to
    # mp3 here to match the other providers.
    async def mp3_chunks() -> AsyncIterator[bytes]:
        encoder = lameenc.Encoder()
        encoder.set_in_sample_rate(24000)
        encoder.set_channels(1)
        encoder.set_bit_rate(128)
        got_audio = False
        # A network chunk can end mid-event, so buffer until "\n" before parsing.
        buffer = b""
        async for chunk in response:
            buffer += chunk
            *complete, buffer = buffer.split(b"\n")
            for entry in complete:
                if not entry.startswith(b"data: "):
                    continue
                event = json.loads(entry[len(b"data: "):])
                # Blocked prompts come back 200 with only promptFeedback.
                if "candidates" not in event:
                    raise ProviderError(
                        f"Google TTS ({model}) returned no audio: {event.get('promptFeedback')}"
                    )
                for part in event["candidates"][0]["content"]["parts"]:
                    inline_data = part.get("inlineData")
                    if not inline_data:
                        continue
                    # The encoder is configured for exactly this format; Google
                    # documents it as the streaming default, not a guarantee.
                    if inline_data["mimeType"] != "audio/l16; rate=24000; channels=1":
                        raise ProviderError(
                            f"Google TTS ({model}) returned unexpected audio format: "
                            f"{inline_data['mimeType']}"
                        )
                    got_audio = True
                    # lameenc returns bytearray, which StreamingResponse won't send;
                    # the first encode() can also be empty (encoder delay).
                    encoded = encoder.encode(base64.b64decode(inline_data["data"]))
                    if encoded:
                        yield bytes(encoded)
        if not got_audio:
            raise ProviderError(f"Google TTS ({model}) response missing audio content")
        yield bytes(encoder.flush())

    # Pull the first chunk here so the errors above are raised before the
    # response starts.
    chunks = mp3_chunks()
    first = await anext(chunks)

    async def stream() -> AsyncIterator[bytes]:
        yield first
        async for chunk in chunks:
            yield chunk

    return stream()
