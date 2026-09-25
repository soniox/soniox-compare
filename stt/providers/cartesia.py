import asyncio
import traceback
import json
from urllib.parse import urlencode
from typing import Any

import websockets

from config import get_language_mapping
from providers.base import (
    BaseProvider,
    ProviderError,
)
from providers.config import ProviderConfig, SupportedFeatures, FeatureStatus
from utils import make_part, info_message


# Cartesia pins the API behaviour to a dated version, supplied as a query
# parameter because browser WebSockets cannot send custom headers.
CARTESIA_VERSION = "2026-03-01"


class CartesiaProvider(BaseProvider):
    name = "cartesia"

    def __init__(self, config: ProviderConfig):
        super().__init__(config)
        self.config = config
        self.websocket: websockets.ClientConnection | None = None
        self.client_queue: asyncio.Queue[bytes | str] = asyncio.Queue(maxsize=100)
        self._sender: asyncio.Task[Any] | None = None
        self._receiver: asyncio.Task[Any] | None = None
        # Set once the session close is requested, so the final flush turn
        # doesn't add a trailing `<end>` marker after the last words.
        self._closing = False
        # Tracks whether any finalized turn text has been emitted yet. The turns
        # endpoint reports each turn's transcript with no leading space, so
        # consecutive turns must be separated explicitly when concatenated.
        self._has_final_text = False

    async def connect(self) -> None:
        if self._is_connected:
            return

        warnings = self.validate_provider_capabilities("Cartesia")
        for warning in warnings:
            await self.host_queue.put(warning)

        try:
            self.error = None
            self._closing = False
            self._has_final_text = False

            # The endpoint takes no language parameter, so an unsupported input
            # language comes back as nonsense rather than an error. Say so.
            supported_languages = get_language_mapping(self.name)
            unsupported_hints = [
                hint
                for hint in self.config.params.language_hints
                if hint not in supported_languages
            ]
            if unsupported_hints:
                await self.host_queue.put(
                    info_message(
                        "Cartesia",
                        "Cartesia (ink-2) transcribes English, French, Spanish, "
                        "Japanese and Hindi; selected input language(s) "
                        f"{', '.join(unsupported_hints)} are not among them.",
                        level="warning",
                    )
                )

            url_params = {
                "model": self.config.service.model,
                "encoding": self.config.common.audio_format,
                "sample_rate": self.config.common.sample_rate,
                "cartesia_version": CARTESIA_VERSION,
            }
            query_string = urlencode(url_params)
            full_url = f"{self.config.service.websocket_url}?{query_string}"
            headers = {"X-API-Key": self.config.service.api_key}

            self.websocket = await websockets.connect(
                full_url, additional_headers=headers
            )
            self._is_connected = True
            self._sender = asyncio.create_task(self._send_loop())
            self._receiver = asyncio.create_task(self._recv_loop())
        except Exception as ex:
            self.error = ex
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
        if self.error is not None:
            raise self.error
        if not self._is_connected:
            raise ProviderError("Not connected.")
        try:
            self.client_queue.put_nowait(data)
        except asyncio.QueueFull:
            self.error = ProviderError("Queue full: disconnecting.")
            await self.disconnect()
            raise self.error

    async def send_end(self) -> None:
        # On the turns endpoint, `close` is a JSON text message that flushes any
        # buffered audio into events and ends the session cleanly. There is no
        # `finalize` command: turn boundaries are detected by the model.
        if self.websocket:
            self._closing = True
            self.client_queue.put_nowait(json.dumps({"type": "close"}))


    async def _send_loop(self):
        while self._is_connected:
            msg = await self.client_queue.get()
            if not self.websocket:
                break
            try:
                await self.websocket.send(msg)
            except Exception as ex:
                self.error = ex
                await self._handle_error(f"Sender error: {ex}")
                break

    async def _recv_loop(self):
        # The turns endpoint is organised around user turns, not transcript
        # deltas. The `transcript` field is *cumulative within a turn*, which maps
        # directly onto the frontend's model: it replaces the non-final parts on
        # every message and appends final parts. So we emit each `turn.update` as
        # a single (growing) non-final part, and each `turn.end` as a final part.
        # Spacing/punctuation within a turn is baked into the text, but the
        # per-turn transcript has no leading space, so a separator is prepended
        # to every turn after the first to keep concatenated turns readable.
        try:
            async for resp in self.websocket:
                self.emit_raw(resp)
                data = json.loads(resp)
                msg_type = data.get("type")

                if msg_type in ("turn.update", "turn.eager_end"):
                    transcript = data.get("transcript", "")
                    if transcript:
                        if self._has_final_text:
                            transcript = " " + transcript
                        await self._emit_parts(
                            [make_part(text=transcript, is_final=False)]
                        )
                elif msg_type == "turn.end":
                    transcript = data.get("transcript", "")
                    parts: list[dict[str, Any]] = []
                    if transcript:
                        if self._has_final_text:
                            transcript = " " + transcript
                        parts.append(make_part(text=transcript, is_final=True))
                        self._has_final_text = True
                    # `turn.end` is the model's native endpoint. Append a
                    # `<end>` marker (matching the other providers), but skip
                    # the flush turn produced by the explicit session close.
                    if (
                        parts
                        and self.config.params.enable_endpoint_detection
                        and not self._closing
                    ):
                        parts.append(make_part(text=" <end>", is_final=True))
                    await self._emit_parts(parts)
                elif msg_type == "error":
                    await self._handle_error(data.get("message", "Unknown error"))
                    break
                # `connected`, `turn.start`, and `turn.resume` carry no transcript
                # text we need to surface, so they are ignored.
        except Exception as ex:
            self.error = ex
            await self._handle_error(f"Receiver error: {ex}")

    async def _emit_parts(self, parts: list[dict[str, Any]]) -> None:
        await self.host_queue.put(
            {
                "type": "data",
                "provider": self.name,
                "parts": parts,
            }
        )

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
        unsupported = FeatureStatus.unsupported()
        return SupportedFeatures(
            name="Cartesia",
            model="ink-2",
            # One model covers all five languages and takes no language
            # parameter, so it detects what it hears.
            single_multilingual_model=supported,
            language_hints=unsupported,
            language_identification=unsupported,
            speaker_diarization=unsupported,
            customization=unsupported,
            # The turns endpoint reports per-turn transcripts, not word timestamps.
            timestamps=unsupported,
            confidence_scores=unsupported,
            real_time_latency_config=unsupported,
            # The model detects user-turn boundaries itself (native turn detection).
            endpoint_detection=FeatureStatus.supported(
                comment="The model detects user-turn boundaries natively; each "
                "turn is emitted as a finalized transcript."
            ),
            manual_finalization=unsupported,
        )
