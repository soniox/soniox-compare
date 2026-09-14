import logging
import os

from dotenv import load_dotenv
from fastapi import FastAPI, Query, Request
from fastapi.responses import JSONResponse, PlainTextResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles

from languages import SUPPORTED_LANGUAGES, is_language_supported
from providers import (
    azure,
    cartesia,
    elevenlabs,
    google,
    openai,
    smallest,
    smallest_pro,
    soniox,
)
from providers.base import ProviderError

PROVIDER_MAP = {
    "soniox": soniox.generate,
    "google": google.generate,
    "openai": openai.generate,
    "elevenlabs": elevenlabs.generate,
    "cartesia": cartesia.generate,
    "azure": azure.generate,
    "smallest": smallest.generate,
    "smallest_pro": smallest_pro.generate,
}

load_dotenv()

logging.basicConfig(
    level=os.environ.get("LOG_LEVEL", "INFO"),
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
log = logging.getLogger("tts")

MAX_TEXT_LENGTH = 256

# Set by dev.sh. Browsers otherwise reuse a clip for an hour, which hides
# provider and prompt changes behind a stale cache while iterating.
DEV = os.getenv("DEV") == "1"
AUDIO_CACHE_CONTROL = "no-store" if DEV else "private, max-age=3600"

app = FastAPI()


@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "no-referrer"
    path = request.url.path
    if not path.startswith("/compare/api"):
        if "/assets/" in path:
            response.headers["Cache-Control"] = "public, max-age=31536000, immutable"
        else:
            response.headers["Cache-Control"] = "no-cache"
    return response


@app.get("/compare/api/tts")
async def generate(
    text: str = Query(min_length=1, max_length=MAX_TEXT_LENGTH),
    provider: str = Query(),
    language: str = Query(),
):
    if provider not in PROVIDER_MAP:
        return JSONResponse({"error": f"Unknown provider: {provider}"}, status_code=400)
    if language not in SUPPORTED_LANGUAGES:
        return JSONResponse({"error": f"Unsupported language: {language}"}, status_code=400)
    if not is_language_supported(language, provider):
        return JSONResponse(
            {"error": f"Language {language} is not supported by {provider}"},
            status_code=400,
        )

    try:
        audio_stream = await PROVIDER_MAP[provider](text.strip(), language)
    except ProviderError as error:
        return JSONResponse(
            {"error": f"TTS generation failed: {error}"}, status_code=500
        )

    return StreamingResponse(
        audio_stream,
        media_type="audio/mpeg",
        headers={"Cache-Control": AUDIO_CACHE_CONTROL},
    )


@app.get("/compare/api/config")
def get_config():
    """Supported languages, overall and per provider — the single source of
    truth the frontend builds its selectors and support checks from."""
    return {
        "languages": SUPPORTED_LANGUAGES,
        "provider_languages": {
            provider: [
                language
                for language in SUPPORTED_LANGUAGES
                if is_language_supported(language, provider)
            ]
            for provider in PROVIDER_MAP
        },
    }


@app.get("/.well-known/health/soniox-tts-compare", response_class=PlainTextResponse)
def health() -> str:
    return "ok"


@app.get("/.well-known/version/soniox-tts-compare", response_class=PlainTextResponse)
def version() -> str:
    return os.getenv("VERSION", "")


# Mounted last so it doesn't shadow the API and health routes above.
app.mount("/", StaticFiles(directory="frontend/dist", html=True), name="compare-tts-ui")
