import asyncio
import json
import logging
import os
from typing import Dict, List, Any

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, Query, Request, WebSocket
from fastapi.responses import PlainTextResponse, FileResponse
from fastapi.staticfiles import StaticFiles

from config import (
    get_provider_config,
    get_soniox_service_config,
    get_language_support,
    get_supported_languages,
    unsupported_language,
)
from providers.base import BaseProvider
from utils import error_message

from providers.soniox import SonioxProvider
from providers.deepgram import DeepgramProvider
from providers.assembly import AssemblyProvider, AssemblyStreamingProvider
from providers.google import GoogleProvider
from providers.azure import AzureProvider
from providers.speechmatics import SpeechmaticsProvider
from providers.openai import OpenaiProvider, OpenaiWhisperProvider
from providers.cartesia import CartesiaProvider
from providers.elevenlabs import ElevenlabsProvider
from providers.meta import MetaProvider
from providers.smallest import SmallestProvider
from providers.inworld import InworldProvider
from providers.xai import XaiProvider

from providers.config import ProviderParams

PROVIDER_MAP: Dict[str, type[BaseProvider]] = {
    "soniox": SonioxProvider,
    "openai": OpenaiProvider,
    "openai:whisper": OpenaiWhisperProvider,
    "deepgram": DeepgramProvider,
    "assembly": AssemblyProvider,
    "assembly:streaming": AssemblyStreamingProvider,
    "google": GoogleProvider,
    "azure": AzureProvider,
    "speechmatics": SpeechmaticsProvider,
    "cartesia": CartesiaProvider,
    "elevenlabs": ElevenlabsProvider,
    "meta": MetaProvider,
    "smallest": SmallestProvider,
    "xai": XaiProvider,
    "inworld": InworldProvider,
}

load_dotenv()

logging.basicConfig(
    level=os.environ.get("LOG_LEVEL", "INFO"),
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
log = logging.getLogger("stt")

# Session limits.
MAX_SESSION_SECONDS = 5 * 60
# Total *decoded PCM* we'll accept per session — NOT the source file size (the
# client caps that at 25 MB). Streamed audio is 16 kHz s16le mono = 32 KB/s, so
# 5 min ≈ 9.6 MB; the cap sits above that as a faster-than-realtime dump guard.
MAX_STREAMED_AUDIO_BYTES = 12 * 1024 * 1024


class SessionLimit(Exception):
    """Raised to end a session that hit a resource cap. The message is shown to
    the user on every active provider card."""


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


@app.websocket("/compare/api/compare-websocket")
async def compare_websocket(
    websocket: WebSocket,
    # Parameters from useUrlSettings.ts
    providers: List[str] = Query(
        default=[], max_length=50, description="List of active providers"
    ),
    language_hints: List[str] = Query(
        default=[], max_length=50, description="Hints for input languages"
    ),
    context: str = Query(
        default="", max_length=1000, description="Context for transcription"
    ),
    enable_speaker_diarization: bool = Query(
        default=True, description="Enable speaker diarization"
    ),
    enable_language_identification: bool = Query(
        default=True, description="Enable language identification"
    ),
    enable_endpoint_detection: bool = Query(
        default=False, description="Enable endpoint detection"
    ),
    options: str = Query(
        default="{}",
        max_length=4000,
        description='Per-provider option overrides, JSON keyed by provider: '
        '{"xai": {"filler_words": false}}',
    ),
):
    await websocket.accept()

    active_providers: Dict[str, BaseProvider] = {}
    receive_tasks = {}

    try:
        # A malformed blob from a hand-edited URL falls back to the declared
        # defaults rather than killing the session for every card.
        try:
            option_overrides = json.loads(options)
        except json.JSONDecodeError:
            option_overrides = {}
        if not isinstance(option_overrides, dict):
            option_overrides = {}

        provider_params = ProviderParams(
            language_hints=language_hints,
            context=context,
            enable_speaker_diarization=enable_speaker_diarization,
            enable_language_identification=enable_language_identification,
            enable_endpoint_detection=enable_endpoint_detection,
        )

        # Load providers
        for name in providers:
            try:
                provider_class = PROVIDER_MAP.get(name)
                if provider_class is None:
                    raise ValueError(f"Unknown provider: {name}")

                missing = unsupported_language(name, language_hints)
                if missing is not None:
                    raise ValueError(f"Language {missing} is not supported by {name}")

                per_provider = option_overrides.get(name)
                if isinstance(per_provider, dict):
                    provider_params.options = per_provider
                else:
                    provider_params.options = {}

                provider_config = get_provider_config(
                    name=name,
                    params=provider_params,
                )
                provider_instance: BaseProvider = provider_class(provider_config)
                active_providers[name] = provider_instance
                await provider_instance.connect()
            except Exception as ex:
                await websocket.send_json(
                    error_message(
                        provider=name,
                        message=f"{ex}",
                    )
                )

        async def forward_to_client(provider_name, provider_instance):
            try:
                while provider_instance.is_connected():
                    for message in await provider_instance.receive():
                        message["provider"] = provider_name
                        await websocket.send_json(message)
            except Exception as e:
                await websocket.send_json(
                    error_message(provider=provider_name, message=f"Receive error: {e}")
                )

        # Start receive tasks for each provider
        for name, provider in active_providers.items():
            if not provider.is_connected():  # noqa
                continue
            task = asyncio.create_task(forward_to_client(name, provider))
            receive_tasks[name] = task

        async def send_session_limit_exceeded(message: str) -> None:
            for name in active_providers:
                try:
                    event = error_message(provider=name, message=message)
                    event["session_ended"] = True  # frontend stops the session on this
                    await websocket.send_json(event)
                except Exception:
                    pass

        # Receive audio from the client and fan it out to every provider. Bound
        # the session so a client can't hold the socket (and N upstream provider
        # connections) open forever or stream unlimited audio: asyncio.timeout
        # caps duration + idle, the byte counter caps volume. Both end the
        # session with a message on every card.
        audio_bytes = 0
        try:
            async with asyncio.timeout(MAX_SESSION_SECONDS):
                while True:
                    received_ws_frame = await websocket.receive()
                    if received_ws_frame.get("type") == "websocket.disconnect":
                        break

                    if "text" in received_ws_frame:
                        actual_payload = received_ws_frame["text"]
                    elif "bytes" in received_ws_frame:
                        actual_payload = received_ws_frame["bytes"]
                        audio_bytes += len(actual_payload)
                        if audio_bytes > MAX_STREAMED_AUDIO_BYTES:
                            raise SessionLimit(
                                "Audio length limit reached. Please use a shorter clip."
                            )
                    else:
                        break  # unknown frame format — end the session

                    # Send message to all providers
                    for name, provider in active_providers.items():
                        if not provider.is_connected():
                            continue
                        try:
                            if actual_payload == "END":
                                await provider.send_end()
                            else:
                                await provider.send(actual_payload)
                        except Exception as ex:
                            await websocket.send_json(
                                error_message(
                                    provider=name,
                                    message=f"Error while sending message to provider: {ex}",
                                )
                            )
        except SessionLimit as limit:
            await send_session_limit_exceeded(str(limit))
        except TimeoutError:
            await send_session_limit_exceeded(
                f"Session time limit reached ({MAX_SESSION_SECONDS // 60} min). Please start a new session."
            )
        except Exception:
            pass  # client disconnected or sent a bad frame — clean up below

    finally:
        # Cancel all receive tasks
        for task in receive_tasks.values():
            task.cancel()

        # Clean up providers
        for name, provider in active_providers.items():
            if not provider.is_connected():
                continue
            try:
                await provider.disconnect()
            except Exception as ex:
                await websocket.send_json(
                    error_message(
                        provider=name,
                        message=f"Error during provider cleanup: {ex}",
                    )
                )


@app.get("/compare/api/providers-features", response_model=Dict[str, Any])
async def get_providers():
    all_features: Dict[str, Any] = {}

    for name, provider_class in PROVIDER_MAP.items():
        all_features[name] = provider_class.get_available_features()
    return all_features


@app.get("/compare/api/language-support", response_model=Dict[str, Any])
async def get_providers_language_support():
    """Input-language codes (ISO-639-1) for the language selector.

    `all_languages` is what the selector offers: the union across providers.
    `providers` lists each provider's own codes, so the selector can show
    which providers support each language. Every provider is listed, Soniox
    included.
    """
    return {
        "all_languages": get_supported_languages(),
        "providers": get_language_support(PROVIDER_MAP),
    }


@app.get("/compare/api/soniox-model", response_model=Dict[str, Any])
async def get_soniox_model():
    soniox_service_config = get_soniox_service_config()

    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(
            "https://api.soniox.com/v1/models",
            headers={"Authorization": f"Bearer {soniox_service_config.api_key}"},
        )
        resp.raise_for_status()
        models = resp.json()
        for model in models["models"]:
            if model["id"] == "stt-rt-v5":
                return model
        raise Exception("Model not found")


@app.get("/.well-known/health/soniox-compare", response_class=PlainTextResponse)
def health() -> str:
    return "ok"


@app.get("/.well-known/version/soniox-compare", response_class=PlainTextResponse)
def version() -> str:
    return os.getenv("VERSION", "")


# Mounted last so it doesn't shadow the API and health routes above.
app.mount("/", StaticFiles(directory="frontend/dist", html=True), name="compare-ui")
