from typing import AsyncIterator

from languages import get_provider_language
from providers.base import ProviderError, _require_env, _stream_post


async def generate(text: str, language: str) -> AsyncIterator[bytes]:
    api_key = _require_env("DEEPGRAM_API_KEY")

    # Aura bakes the language into the voice, so the language table holds the
    # model id ("aura-2-agathe-fr") rather than a language code.
    voice = get_provider_language(language, "deepgram")
    if not voice:
        raise ProviderError(f"Language {language} is not supported by Deepgram TTS")

    return await _stream_post(
        f"https://api.deepgram.com/v1/speak?model={voice}",
        error_prefix="Deepgram TTS error",
        headers={
            "Authorization": f"Token {api_key}",
            "Content-Type": "application/json",
        },
        json={"text": text},
    )
