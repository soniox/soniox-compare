import asyncio
import traceback
import websockets
import json
from providers.base import (
    BaseProvider,
    ProviderError,
)
from providers.config import ProviderConfig, FeatureStatus, SupportedFeatures
from utils import make_part
from typing import Any


class SonioxProvider(BaseProvider):
    name = "soniox"

    def __init__(self, config: ProviderConfig):
        super().__init__(config)
        self.config = config
        self.websocket: websockets.ClientConnection | None = None
        self.client_queue: asyncio.Queue[bytes | str] = asyncio.Queue(maxsize=100)
        self._sender: asyncio.Task[Any] | None = None
        self._receiver: asyncio.Task[Any] | None = None

    async def connect(self) -> None:
        if self._is_connected:
            return

        warnings = self.validate_provider_capabilities("Soniox")
        for warning in warnings:
            await self.host_queue.put(warning)

        try:
            self.websocket = await websockets.connect(self.config.service.websocket_url)
            init_msg = {
                "api_key": self.config.service.api_key,
                "audio_format": self.config.common.audio_format,
                "sample_rate": self.config.common.sample_rate,
                "num_channels": self.config.common.num_channels,
                "model": self.config.service.model,
                "enable_speaker_diarization": self.config.params.enable_speaker_diarization,  # noqa
                "enable_language_identification": self.config.params.enable_language_identification,  # noqa
                "language_hints": self.config.params.language_hints,
                "context": {"text": self.config.params.context},
            }
            if self.config.params.enable_language_identification:
                init_msg["enable_language_identification"] = True

            if self.config.params.enable_speaker_diarization:
                init_msg["enable_speaker_diarization"] = True

            if self.config.params.enable_endpoint_detection:
                init_msg["enable_endpoint_detection"] = True

            await self.websocket.send(json.dumps(init_msg))
            self._is_connected = True
            # Start bg tasks
            self._sender = asyncio.create_task(self._send_loop())
            self._receiver = asyncio.create_task(self._recv_loop())
        except Exception as ex:
            raise ProviderError(f"{ex}")

    async def disconnect(self) -> None:
        self._is_connected = False
        self.host_queue.put_nowait(None)
        if self._sender:
            self._sender.cancel()
        if self._receiver:
            self._receiver.cancel()
        if self.websocket:
            await self.websocket.close()

    async def send(self, data: bytes | str) -> None:
        if not self._is_connected:
            raise ProviderError("Not connected.")
        try:
            self.client_queue.put_nowait(data)
        except asyncio.QueueFull:
            await self.disconnect()
            raise ProviderError("Queue full: disconnecting.")

    async def send_end(self) -> None:
        end_msg = ""
        await self.send(end_msg)


    async def _send_loop(self):
        while self._is_connected:
            msg = await self.client_queue.get()
            try:
                if self.websocket:
                    await self.websocket.send(msg)
            except Exception as ex:
                await self._handle_error(ex)
                break

    async def _recv_loop(self):
        try:
            async for resp in self.websocket:
                self.emit_raw(resp)
                data = json.loads(resp)
                if "error_message" in data:
                    await self._handle_error(data["error_message"])
                    break
                parts = []
                if "tokens" in data:
                    for t in data["tokens"]:
                        text = t.get("text")
                        is_final = t.get("is_final")
                        speaker = t.get("speaker")
                        language = t.get("language")
                        start_ms = t.get("start_ms")
                        end_ms = t.get("end_ms")
                        confidence = t.get("confidence")

                        parts.append(
                            make_part(
                                text=text,
                                is_final=is_final,
                                speaker=speaker,
                                language=language,
                                start_ms=start_ms,
                                end_ms=end_ms,
                                confidence=confidence,
                            )
                        )
                if parts:
                    await self.host_queue.put(
                        {
                            "type": "data",
                            "provider": self.name,
                            "parts": parts,
                        }
                    )
        except Exception as ex:
            await self._handle_error(ex)

    async def _handle_error(self, ex):
        traceback.print_exc()

        await self.host_queue.put(
            {
                "type": "error",
                "provider": self.name,
                "error_message": str(ex),
            }
        )
        await self.disconnect()

    @staticmethod
    def get_available_features():
        supported = FeatureStatus.supported()
        return SupportedFeatures(
            name="Soniox",
            model="stt-rt-v5",
            single_multilingual_model=supported,
            language_hints=supported,
            max_language_hints=None,  # unlimited
            language_identification=supported,
            speaker_diarization=supported,
            customization=supported,
            timestamps=supported,
            confidence_scores=supported,
            real_time_latency_config=supported,
            endpoint_detection=supported,
            manual_finalization=supported,
        )
