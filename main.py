import asyncio
import importlib
import os
from typing import Dict, List, Any

import aiohttp
from dotenv import load_dotenv
from fastapi import FastAPI, Query, Request, WebSocket
from fastapi.responses import HTMLResponse, PlainTextResponse, FileResponse
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles

from config import get_provider_config, get_soniox_service_config
from providers.base_provider import BaseProvider
from utils import error_message

from providers.soniox.provider import SonioxProvider
from providers.deepgram.provider import DeepgramProvider
from providers.assembly.provider import AssemblyProvider
from providers.google.provider import GoogleProvider
from providers.azure.provider import AzureProvider
from providers.speechmatics.provider import SpeechmaticsProvider
from providers.openai.provider import OpenaiProvider

from providers.config import ProviderParams, TranslationConfig, OperationMode

PROVIDERS = [
    SonioxProvider,
    OpenaiProvider,
    DeepgramProvider,
    AssemblyProvider,
    GoogleProvider,
    AzureProvider,
    SpeechmaticsProvider,
]

load_dotenv()

app = FastAPI()
templates = Jinja2Templates(directory="templates")


@app.get("/compare/ui", response_class=HTMLResponse)
@app.get("/compare/ui/", response_class=HTMLResponse)
async def index(request: Request):
    return FileResponse("frontend/dist/index.html")


@app.get("/compare/api/old", response_class=HTMLResponse)
async def old(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})


YIELD_DELAY_S = 0


@app.websocket("/compare/api/compare-websocket")
async def compare_websocket(
    websocket: WebSocket,
    # Parameters from useUrlSettings.ts
    providers: List[str] = Query(default=[], description="List of active providers"),
    mode: OperationMode = Query(
        default="stt", description="Mode of operation (stt/mt)"
    ),
    language_hints: List[str] = Query(
        default=[], description="Hints for input languages"
    ),
    context: str = Query(default="", description="Context for transcription"),
    enable_speaker_diarization: bool = Query(
        default=False, description="Enable speaker diarization"
    ),
    enable_language_identification: bool = Query(
        default=False, description="Enable language identification"
    ),
    enable_endpoint_detection: bool = Query(
        default=False, description="Enable endpoint detection"
    ),
    translation_target_language: str = Query(
        default="", description="Target language for translation"
    ),
    translation_source_languages: List[str] = Query(
        default=[], description="Source languages for translation"
    ),
    translation_language_a: str = Query(
        default=None, description="Language A for two_way translation"
    ),
    translation_language_b: str = Query(
        default=None, description="Language B for two_way translation"
    ),
    translation_type: str = Query(
        default="one_way", description="Type of translation (one_way/two_way)"
    ),
):
    await websocket.accept()

    active_providers: Dict[str, BaseProvider] = {}
    receive_tasks = {}

    try:
        translation_cfg = None
        if mode == "mt":
            translation_cfg = TranslationConfig(
                target_language=translation_target_language,
                source_languages=translation_source_languages,
                language_a=translation_language_a,
                language_b=translation_language_b,
                type=translation_type,
            )

        provider_params = ProviderParams(
            mode=mode,
            language_hints=language_hints,
            context=context,
            enable_speaker_diarization=enable_speaker_diarization,
            enable_language_identification=enable_language_identification,
            enable_endpoint_detection=enable_endpoint_detection,
            translation=translation_cfg if mode == "mt" else None,
        )

        # --- BEGIN DEBUG PRINT ---
        print("--------------------------------------")
        print(f"provider_params: {provider_params.model_dump_json(indent=2)}")
        print("--------------------------------------")
        # --- END DEBUG PRINT ---

        # Load providers
        for name in providers:
            try:
                module = importlib.import_module(f"providers.{name}.provider")
                provider_class = getattr(module, f"{name.capitalize()}Provider")

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
                while True:
                    messages = await provider_instance.receive()
                    for message in messages:
                        if message is not None:
                            assert provider_name, "Provider name must be set"
                            message["provider"] = provider_name
                            await websocket.send_json(message)
                        else:
                            print(f"Warning: Received a None message from {provider_name}. Skipping.")
                    await asyncio.sleep(YIELD_DELAY_S)
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

        # Receive messages from client and forward to all providers
        while True:
            try:
                received_ws_frame = await websocket.receive()

                # Handle WebSocket disconnect message explicitly
                if received_ws_frame.get("type") == "websocket.disconnect":
                    break

                actual_payload = None
                if "text" in received_ws_frame:
                    actual_payload = received_ws_frame["text"]
                elif "bytes" in received_ws_frame:
                    actual_payload = received_ws_frame["bytes"]
                else:
                    raise Exception("Unknown websocket message format.")

            except Exception as ex:  # noqa
                break  # If error with websocket, exit loop

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

    for provider_class in PROVIDERS:
        provider_features = provider_class.get_available_features()
        key_name = provider_class.__name__.replace("Provider", "").lower()
        all_features[key_name] = provider_features
    return all_features


@app.get("/compare/api/soniox-model", response_model=Dict[str, Any])
async def get_soniox_model():
    soniox_service_config = get_soniox_service_config()

    async with aiohttp.ClientSession() as session:
        async with session.get(
            "https://api.soniox.com/v1/models",
            headers={"Authorization": f"Bearer {soniox_service_config.api_key}"},
        ) as resp:
            resp.raise_for_status()
            models = await resp.json()
            for model in models["models"]:
                if model["id"] == "stt-rt-preview":
                    return model
            raise Exception("Model not found")


@app.get("/.well-known/health/soniox-compare", response_class=PlainTextResponse)
def health() -> str:
    return "ok"


@app.get("/.well-known/version/soniox-compare", response_class=PlainTextResponse)
def version() -> str:
    return os.getenv("VERSION", "")


if os.path.exists("frontend/dist"):
    app.mount("/compare/ui", StaticFiles(directory="frontend/dist"), name="static")
