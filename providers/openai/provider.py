import asyncio
import traceback
import math
import base64
import json
from typing import Any

import aiohttp
import websockets

from providers.base_provider import (
    BaseProvider,
    ProviderError,
)
from providers.config import ProviderConfig, SupportedFeatures, FeatureStatus
from utils import make_part


class OpenaiProvider(BaseProvider):
    def __init__(self, config: ProviderConfig):
        super().__init__(config)
        self.config = config
        self.websocket: websockets.ClientConnection | None = None
        self.client_queue: asyncio.Queue[bytes | str] = asyncio.Queue(maxsize=100)
        self.host_queue: asyncio.Queue[dict[str, Any]] = asyncio.Queue()
        self._sender: asyncio.Task[Any] | None = None
        self._receiver: asyncio.Task[Any] | None = None

        self.silence_duration_ms: int = 100
        self.end_event = asyncio.Event()

    async def connect(self) -> None:
        if self._is_connected:
            return
        self.validate_provider_capabilities("OpenAI")
        try:
            self.end_event.clear()
            if len(self.config.params.language_hints) > 1:
                raise ProviderError("OpenAI supports at most one language input.")

            language = None
            if self.config.params.mode == "stt":
                if self.config.params.language_hints:
                    language = self.config.params.language_hints[0]
            elif self.config.params.mode == "mt":
                if not (
                    self.config.params.translation
                    and self.config.params.translation.source_languages
                ):
                    raise ProviderError(
                        "Missing translation source language for MT mode."
                    )
                language = self.config.params.translation.source_languages[0]

            # Create a transcription session via the REST API to obtain an ephemeral
            # token.
            # This endpoint uses the beta header "OpenAI-Beta: assistants=v2".
            # https://platform.openai.com/docs/api-reference/realtime-client-events/transcription_session/update

            # For translations we do not use https://api.openai.com/v1/audio/translations endpoint.
            # Instead we use transcription session with a special prompt. Any language
            # is supported as long as it has ISO-639-1 ("en") code.

            session_settings = self._build_transcription_settings(language)

            payload = {
                "input_audio_format": "pcm16",
                **session_settings,
            }
            headers = {
                "Authorization": f"Bearer {self.config.service.api_key}",
                "Content-Type": "application/json",
                "OpenAI-Beta": "assistants=v2",
            }
            if language is not None:
                payload["input_audio_transcription"]["language"] = language  # type: ignore # noqa

            # Fix this, so that it is not hardcoded - it can be derived from
            # websocket url.
            create_session_url: str = (
                "https://api.openai.com/v1/realtime/transcription_sessions"
            )

            async with aiohttp.ClientSession() as session:
                async with session.post(
                    create_session_url, json=payload, headers=headers
                ) as resp:
                    if resp.status != 200:
                        text = await resp.text()
                        raise Exception(
                            "Failed to create transcription session: "
                            f" {resp.status} {text}"
                        )
                    data = await resp.json()
                    ephemeral_token = data["client_secret"]["value"]

            connection_headers = {
                "Authorization": f"Bearer {ephemeral_token}",
                "OpenAI-Beta": "realtime=v1",
            }

            self.websocket = await websockets.connect(
                self.config.service.websocket_url, additional_headers=connection_headers
            )

            update_event = {
                "type": "transcription_session.update",
                "session": session_settings,
            }
            if language is not None:
                update_event["session"]["input_audio_transcription"]["language"] = language  # type: ignore # noqa

            await self.websocket.send(json.dumps(update_event))

            self._is_connected = True
            # Start bg tasks
            self._sender = asyncio.create_task(self._send_loop())
            self._receiver = asyncio.create_task(self._recv_loop())
        except Exception as ex:
            self.error = ProviderError(f"{ex}")
            raise self.error

    async def disconnect(self) -> None:
        self._is_connected = False
        if self._sender:
            self._sender.cancel()
        if self._receiver:
            self._receiver.cancel()
        if self.websocket:
            await self.websocket.close()

    async def send(self, data: bytes | str) -> None:
        if self.error is not None:
            raise self.error
        if not self._is_connected:
            raise ProviderError("Not connected.")
        try:
            self.client_queue.put_nowait(data)
        except asyncio.QueueFull:
            await self.disconnect()
            self.error = ProviderError("Queue full: disconnecting.")
            raise self.error

    async def send_end(self) -> None:
        commit_event = {"type": "input_audio_buffer.commit"}
        if self.websocket:
            await self.websocket.send(json.dumps(commit_event))
            self.end_event.set()

    async def receive(self) -> list[dict[str, Any]]:
        items = list[dict[str, Any]]()
        while not self.host_queue.empty():
            items.append(await self.host_queue.get())
        return items

    async def _send_loop(self):
        while self._is_connected:
            msg = await self.client_queue.get()
            try:
                if self.websocket:
                    audio_chunk = base64.b64encode(msg).decode("utf-8")
                    audio_event = {
                        "type": "input_audio_buffer.append",
                        "audio": audio_chunk,
                    }
                    await self.websocket.send(json.dumps(audio_event))
            except Exception as ex:
                self.error = ex
                await self._handle_error(ex)
                break

    async def _recv_loop(self):
        try:
            non_final_parts = []

            async for resp in self.websocket:
                event = json.loads(resp)

                event_type = event.get("type")
                if event_type == "conversation.item.input_audio_transcription.delta":
                    logprobs = event.get("logprobs", None)

                    if logprobs:
                        for token in logprobs:
                            non_final_parts.append(
                                make_part(
                                    text=token["token"],
                                    is_final=False,
                                    speaker=None,
                                    language=None,
                                    start_ms=None,
                                    end_ms=None,
                                    confidence=math.exp(token["logprob"]),
                                )
                            )

                        if len(non_final_parts) > 0:
                            non_final_parts[-1]["text"] += " "

                        await self.host_queue.put(
                            {
                                "type": "data",
                                "provider": self.config.service.provider_name,
                                "parts": non_final_parts,
                            }
                        )
                elif (
                    event_type
                    == "conversation.item.input_audio_transcription.completed"
                ):
                    if non_final_parts:
                        non_final_parts = []

                        logprobs = event.get("logprobs", None)

                        if logprobs:
                            parts = []

                            for token in logprobs:
                                parts.append(
                                    make_part(
                                        text=token["token"],
                                        is_final=True,
                                        speaker=None,
                                        language=None,
                                        start_ms=None,
                                        end_ms=None,
                                        confidence=math.exp(token["logprob"]),
                                    )
                                )

                            if len(parts) > 0:
                                parts[-1]["text"] += " "

                            await self.host_queue.put(
                                {
                                    "type": "data",
                                    "provider": self.config.service.provider_name,
                                    "parts": parts,
                                }
                            )
                    if self.end_event.is_set():
                        break
        except Exception as ex:
            self.error = ex
            await self._handle_error(ex)

    async def _handle_error(self, ex):
        traceback.print_exc()

        await self.host_queue.put(
            {
                "type": "error",
                "provider": self.config.service.provider_name,
                "error_message": str(ex),
            }
        )
        await self.disconnect()

    def _build_transcription_settings(self, language: str | None) -> dict:
        """Builds transcription settings shared by REST and Websocket init to avoid duplication"""
        settings = {
            "model": self.config.service.model,
            "prompt": self.config.service.prompt,
        }
        if language:
            settings["language"] = language
        return {
            "input_audio_transcription": settings,
            "turn_detection": {
                "type": "server_vad",
                "silence_duration_ms": self.silence_duration_ms,
            },
            "include": [
                "item.input_audio_transcription.logprobs",
            ],
        }

    @staticmethod
    def get_available_features():
        supported = FeatureStatus.supported()
        unsupported = FeatureStatus.unsupported()
        return SupportedFeatures(
            name="OpenAI",
            model="gpt-4o-transcribe",
            single_multilingual_model=supported,
            language_hints=unsupported,
            language_identification=unsupported,
            speaker_diarization=unsupported,
            customization=supported,
            timestamps=unsupported,
            confidence_scores=supported,
            translation_one_way=supported,
            translation_two_way=unsupported,
            real_time_latency_config=unsupported,
            endpoint_detection=unsupported,
            manual_finalization=unsupported,
        )
