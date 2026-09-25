import asyncio
import base64
import json
from typing import Any

import websockets

from config import get_language_mapping
from providers.base import (
    BaseProvider,
    ProviderError,
)
from providers.config import ProviderConfig, SupportedFeatures, FeatureStatus
from utils import make_part


class InworldProvider(BaseProvider):
    name = "inworld"

    def __init__(self, config: ProviderConfig):
        super().__init__(config)
        self.websocket: websockets.ClientConnection | None = None
        self.client_queue: asyncio.Queue[bytes | str] = asyncio.Queue(maxsize=100)
        self._sender: asyncio.Task[Any] | None = None
        self._receiver: asyncio.Task[Any] | None = None
        # Utterances arrive with no leading space, so they run together.
        self._has_final_text = False

    def get_lang_cfg(self) -> str | None:
        hints = self.config.params.language_hints
        if not hints:
            # Left empty the model auto-detects, which the docs recommend
            # when speakers switch languages mid-stream.
            return None
        lang_mapping = get_language_mapping("inworld")
        lang_hint = hints[0]
        if lang_hint not in lang_mapping:
            raise ProviderError(f"Language {lang_hint} not supported by Inworld.")
        return lang_mapping[lang_hint]

    async def connect(self) -> None:
        if self._is_connected:
            return

        warnings = self.validate_provider_capabilities("Inworld")
        for warning in warnings:
            await self.host_queue.put(warning)

        try:
            transcribe_config = {
                "modelId": self.config.service.model,
                "audioEncoding": "LINEAR16",
                "sampleRateHertz": self.config.common.sample_rate,
                "numberOfChannels": self.config.common.num_channels,
            }
            language = self.get_lang_cfg()
            if language:
                transcribe_config["language"] = language

            headers = {"Authorization": f"Basic {self.config.service.api_key}"}
            self.websocket = await websockets.connect(
                self.config.service.websocket_url, additional_headers=headers
            )
            await self.websocket.send(
                json.dumps({"transcribeConfig": transcribe_config})
            )

            self._is_connected = True
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
        # Required on the WebSocket; flushes the trailing transcript.
        if self.websocket:
            self.client_queue.put_nowait(json.dumps({"closeStream": {}}))

    async def _send_loop(self):
        while self._is_connected:
            msg = await self.client_queue.get()
            if not self.websocket:
                break
            try:
                if isinstance(msg, bytes):
                    # Audio goes as base64 inside a JSON frame rather than as a
                    # binary frame.
                    msg = json.dumps(
                        {
                            "audioChunk": {
                                "content": base64.b64encode(msg).decode("ascii")
                            }
                        }
                    )
                await self.websocket.send(msg)
            except Exception as ex:
                await self._handle_error(f"Sender error: {ex}")
                break

    async def _recv_loop(self):
        try:
            async for resp in self.websocket:
                self.emit_raw(resp)
                data = json.loads(resp)

                if "error" in data:
                    error = data["error"] or {}
                    await self._handle_error(error.get("message", "Unknown error"))
                    break

                result = data.get("result") or {}
                transcription = result.get("transcription")
                if transcription:
                    await self._handle_transcription(transcription)
        except Exception as ex:
            await self._handle_error(f"Receiver error: {ex}")

    async def _handle_transcription(self, transcription: dict) -> None:
        text = (transcription.get("transcript") or "").strip()
        if not text:
            return

        if self._has_final_text:
            text = " " + text

        is_final = bool(transcription.get("isFinal", False))
        parts = [make_part(text=text, is_final=is_final)]

        if is_final:
            self._has_final_text = True
            if self.config.params.enable_endpoint_detection:
                parts.append(make_part(text=" <end>", is_final=True))

        await self.host_queue.put(
            {
                "type": "data",
                "provider": self.name,
                "parts": parts,
            }
        )

    async def _handle_error(self, ex):
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
        unsupported = FeatureStatus.unsupported()
        return SupportedFeatures(
            name="Inworld",
            model="inworld-stt-1",
            single_multilingual_model=supported,
            language_hints=supported,
            language_identification=FeatureStatus.unsupported(
                comment="The transcription carries no detected-language field; "
                "`language` is an input hint only.",
            ),
            speaker_diarization=FeatureStatus.unsupported(
                comment="Offered only as an experimental feature, with no "
                "documented field on the streaming transcribe config, so it is "
                "not enabled here.",
            ),
            customization=FeatureStatus.supported(
                comment="Inworld takes `prompts` as a soft recognition bias "
                "rather than a hard keyword lock.",
            ),
            timestamps=FeatureStatus.unsupported(
                comment="`wordTimestamps` is returned but its per-word shape is "
                "not documented, so the transcript is forwarded unsegmented.",
            ),
            confidence_scores=unsupported,
            real_time_latency_config=unsupported,
            endpoint_detection=supported,
            manual_finalization=supported,
            text_formatting=FeatureStatus.partial(
                comment="Punctuation and casing are always on, but numbers stay "
                "spelled out; there is no switch for either.",
            ),
        )
