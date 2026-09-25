import asyncio
import logging
import os
from pathlib import Path
from typing import Any, Dict, List

import httpx
from fastapi import FastAPI, HTTPException, Query, Request, WebSocket
from fastapi.responses import PlainTextResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from config import get_credentials, get_provider_config, get_soniox_service_config
from languages import (
    source_language_support,
    target_language_support,
    unsupported_source,
    unsupported_target,
)
from providers.base import BaseProvider
from providers.config import Mode, ProviderParams
from providers.azure import AzureProvider
from providers.gemini import GeminiProvider
from providers.openai import OpenaiProvider
from providers.soniox import SonioxProvider
from providers.speechmatics import SpeechmaticsProvider
from providers.unsupported import UNSUPPORTED_PROVIDERS
from utils import error_message, session_done_event

logging.basicConfig(
    level=os.environ.get("LOG_LEVEL", "INFO"),
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
log = logging.getLogger("translate")

PROVIDER_MAP: Dict[str, type[BaseProvider]] = {
    "soniox": SonioxProvider,
    "openai": OpenaiProvider,
    "gemini": GeminiProvider,
    "speechmatics": SpeechmaticsProvider,
    "azure": AzureProvider,
}

FRONTEND_DIR = Path(__file__).parent / "frontend" / "dist"

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
        # Vite fingerprints everything under /assets/, so it can be cached
        # forever. Everything else must revalidate or users run a stale build.
        if "/assets/" in path:
            response.headers["Cache-Control"] = "public, max-age=31536000, immutable"
        else:
            response.headers["Cache-Control"] = "no-cache"
    return response


@app.websocket("/compare/api/compare-websocket")
async def compare_websocket(
    websocket: WebSocket,
    providers: List[str] = Query(
        default=[], max_length=50, description="Active providers"
    ),
    mode: Mode = Query(default="text", description="'text' or 's2s'"),
    target_language: str = Query(default="es", max_length=64),
    voice: str = Query(default="", max_length=64),
    language_hints: List[str] = Query(
        default=[], max_length=50, description="Source-language hints"
    ),
    enable_speaker_diarization: bool = Query(default=False),
    enable_language_identification: bool = Query(default=False),
    enable_endpoint_detection: bool = Query(default=False),
):
    await websocket.accept()
    client = (
        f"{websocket.client.host}:{websocket.client.port}" if websocket.client else "?"
    )
    log.info(
        "ws.accept client=%s providers=%s mode=%s target=%s voice=%s hints=%s",
        client,
        providers,
        mode,
        target_language,
        voice,
        language_hints,
    )

    active_providers: Dict[str, BaseProvider] = {}
    receive_tasks: Dict[str, asyncio.Task] = {}

    try:
        provider_params = ProviderParams(
            mode=mode,
            target_language=target_language,
            voice=voice,
            language_hints=language_hints,
            enable_speaker_diarization=enable_speaker_diarization,
            enable_language_identification=enable_language_identification,
            enable_endpoint_detection=enable_endpoint_detection,
        )

        async def connect_provider(name: str) -> None:
            try:
                provider_class = PROVIDER_MAP.get(name)
                if provider_class is None:
                    raise ValueError(f"Unknown provider: {name}")

                # The frontend greys these out, so reaching here means a
                # hand-crafted request. Azure would otherwise answer with the
                # untranslated source rather than failing.
                missing = unsupported_target(name, target_language)
                if missing is not None:
                    raise ValueError(
                        f"{missing} is not a supported target language for {name}"
                    )

                missing = unsupported_source(name, language_hints)
                if missing is not None:
                    raise ValueError(
                        f"{missing} is not a supported source language for {name}"
                    )

                provider = provider_class(get_provider_config(name, provider_params))
                active_providers[name] = provider
                await provider.connect()
            except Exception as ex:
                log.warning("provider.connect failed provider=%s err=%s", name, ex)
                await websocket.send_json(
                    error_message(provider=name, message=str(ex))
                )
                # It will never report from a receive task, so tell the client
                # not to wait for it.
                await websocket.send_json(session_done_event(provider=name))

        # In parallel: the browser starts streaming as soon as the socket is
        # accepted, and Azure and Gemini each take ~1s to come up, so sequential
        # connects delay every provider's first token by the sum.
        await asyncio.gather(*(connect_provider(name) for name in providers))

        async def forward_to_client(provider_name: str, provider: BaseProvider):
            try:
                while provider.is_connected():
                    for message in await provider.receive():
                        message["provider"] = provider_name
                        await websocket.send_json(message)
            except asyncio.CancelledError:
                raise
            except Exception as e:
                await websocket.send_json(
                    error_message(
                        provider=provider_name, message=f"Receive error: {e}"
                    )
                )

        for name, provider in active_providers.items():
            if not provider.is_connected():
                continue
            receive_tasks[name] = asyncio.create_task(forward_to_client(name, provider))

        async def send_session_limit_exceeded(message: str) -> None:
            for name in active_providers:
                try:
                    event = error_message(provider=name, message=message)
                    event["session_ended"] = True  # frontend stops the session on this
                    await websocket.send_json(event)
                except Exception:
                    pass

        # Fan the browser's single PCM stream out to every connected provider.
        # Bound the session so a client can't hold the socket (and N upstream
        # provider connections) open forever or stream unlimited audio:
        # asyncio.timeout caps duration + idle, the byte counter caps volume.
        # Both end the session with a message on every card.
        audio_bytes = 0
        try:
            async with asyncio.timeout(MAX_SESSION_SECONDS):
                while True:
                    frame = await websocket.receive()
                    if frame.get("type") == "websocket.disconnect":
                        break
                    if "text" in frame:
                        payload = frame["text"]
                    elif "bytes" in frame:
                        payload = frame["bytes"]
                        audio_bytes += len(payload)
                        if audio_bytes > MAX_STREAMED_AUDIO_BYTES:
                            raise SessionLimit(
                                "Audio length limit reached. Please use a shorter clip."
                            )
                    else:
                        break  # unknown frame format — end the session

                    for name, provider in active_providers.items():
                        if not provider.is_connected():
                            continue
                        try:
                            if payload == "END":
                                await provider.send_end()
                            else:
                                await provider.send(payload)
                        except Exception as ex:
                            await websocket.send_json(
                                error_message(
                                    provider=name,
                                    message=f"Error while sending audio to provider: {ex}",
                                )
                            )
        except SessionLimit as limit:
            await send_session_limit_exceeded(str(limit))
        except TimeoutError:
            await send_session_limit_exceeded(
                f"Session time limit reached ({MAX_SESSION_SECONDS // 60} min). Please start a new session."
            )
        except Exception:
            # Usually the client disconnecting or a bad frame; clean up below.
            log.debug("ws.session loop ended", exc_info=True)
    finally:
        for task in receive_tasks.values():
            task.cancel()
        await asyncio.gather(*receive_tasks.values(), return_exceptions=True)
        for provider in active_providers.values():
            try:
                await provider.disconnect()
            except Exception as ex:
                log.warning("provider.disconnect failed err=%s", ex)
        log.info("ws.close client=%s", client)


@app.get("/compare/api/providers-features", response_model=Dict[str, Any])
async def get_providers_features():
    features: Dict[str, Any] = {
        name: provider_class.get_available_features()
        for name, provider_class in PROVIDER_MAP.items()
    }
    # Providers the UI shows greyed out. They have no class and can never run;
    # `compare_websocket` rejects them via PROVIDER_MAP lookup.
    features.update(UNSUPPORTED_PROVIDERS)
    return features


class LanguageSupport(BaseModel):
    # Every language at least one provider lists: what the picker offers.
    all_languages: List[str]
    providers: Dict[str, List[str]]


def _language_support(providers: Dict[str, List[str]]) -> LanguageSupport:
    return LanguageSupport(
        all_languages=sorted(set().union(*providers.values())), providers=providers
    )


@app.get("/compare/api/language-support", response_model=LanguageSupport)
async def get_language_support():
    """Per-provider *source*-language restrictions.

    Only the providers that are actually told the source language appear here:
    Azure needs a full locale and otherwise auto-detects across four candidates,
    and Speechmatics rejects a source it does not support. Gemini and OpenAI
    auto-detect and never receive the hint, so they are absent and the frontend
    treats that as "supports everything". `all_languages` is the union of the
    constraining providers only; the "Auto-detect" row represents the others.

    Soniox constrains the source too, but its list comes from its own model
    rather than this repo, so it is merged in live.
    """
    support = source_language_support()
    try:
        support["soniox"] = await _soniox_language_codes()
    except Exception as ex:
        # Better to let Soniox look unconstrained than to fail the whole
        # selector; a bad hint still surfaces as an error on its card.
        log.warning("language-support: soniox model unavailable err=%s", ex)
    return _language_support(support)


@app.get("/compare/api/target-language-support", response_model=LanguageSupport)
async def get_target_language_support():
    """Per-provider target-language codes, for greying out the target picker.
    Soniox translates into every language its model hears, so the same live
    list is merged in here."""
    support = target_language_support()
    try:
        support["soniox"] = await _soniox_language_codes()
    except Exception as ex:
        log.warning("target-language-support: soniox model unavailable err=%s", ex)
    return _language_support(support)


@app.get("/compare/api/providers/{name}/voices")
async def list_voices(name: str) -> dict:
    if name not in PROVIDER_MAP:
        raise HTTPException(status_code=404, detail="unknown provider")
    return {
        "voices": await PROVIDER_MAP[name].list_voices(api_key=get_credentials(name))
    }


async def _soniox_model() -> Dict[str, Any]:
    service_config = get_soniox_service_config()
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(
            "https://api.soniox.com/v1/models",
            headers={"Authorization": f"Bearer {service_config.api_key}"},
        )
        resp.raise_for_status()
        for model in resp.json()["models"]:
            if model["id"] == "stt-rt-v5":
                return model
    raise HTTPException(status_code=404, detail="Model not found")


async def _soniox_language_codes() -> List[str]:
    model = await _soniox_model()
    return sorted(lang["code"] for lang in model.get("languages", []))


@app.get(
    "/.well-known/health/soniox-translation-compare", response_class=PlainTextResponse
)
def health() -> str:
    return "ok"


@app.get(
    "/.well-known/version/soniox-translation-compare", response_class=PlainTextResponse
)
def version() -> str:
    return os.getenv("VERSION", "")


# Mounted last so it doesn't shadow the API and health routes above.
app.mount("/", StaticFiles(directory=str(FRONTEND_DIR), html=True), name="compare-ui")
