import asyncio
import websockets
import json
import urllib.parse
from utils import make_part
from typing import Any
from providers.config import ProviderConfig, FeatureStatus, SupportedFeatures
from providers.base_provider import (
    BaseProvider,
    ProviderError,
)


class AssemblyProvider(BaseProvider):
    def __init__(self, config: ProviderConfig):
        super().__init__(config)
        self.websocket: websockets.ClientConnection | None = None
        self.client_queue: asyncio.Queue[bytes | str] = asyncio.Queue(maxsize=100)
        self.host_queue: asyncio.Queue[dict[str, Any]] = asyncio.Queue()
        self._sender: asyncio.Task[Any] | None = None
        self._receiver: asyncio.Task[Any] | None = None

    async def connect(self) -> None:
        if self._is_connected:
            return
        self.validate_provider_capabilities("AssemblyAI")

        if len(self.config.params.language_hints) == 0:
            raise ProviderError("AssemblyAI does not support multilingual mode.")
        elif self.config.params.language_hints[0] != "en":
            raise ProviderError("AssemblyAI does not support this language.")

        try:
            params = {
                "token": self.config.service.api_key,
                "sample_rate": str(self.config.common.sample_rate),
                "encoding": self.config.common.audio_format,
                "format_turns": "true",
            }
            url_with_params = (
                f"{self.config.service.websocket_url}?{urllib.parse.urlencode(params)}"
            )

            self.websocket = await websockets.connect(url_with_params)
            self._is_connected = True
            # Start bg tasks
            self._sender = asyncio.create_task(self._send_loop())
            self._receiver = asyncio.create_task(self._recv_loop())
        except Exception as ex:
            self.error = ex
            raise ProviderError(f"Connection failed: {ex}")

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
            raise ProviderError("Queue full: disconnecting.")

    async def send_end(self) -> None:
        assert self.websocket is not None
        await self.websocket.send(json.dumps({"type": "Terminate"}))

    async def receive(self) -> list[dict[str, Any]]:
        items = []
        while not self.host_queue.empty():
            items.append(await self.host_queue.get())
        return items

    async def _send_loop(self) -> None:
        while self._is_connected:
            msg = await self.client_queue.get()
            try:
                if isinstance(msg, bytes):
                    assert self.websocket is not None
                    await self.websocket.send(msg)
            except Exception as ex:
                self.error = ex
                await self._handle_error(ex)
                break

    async def _send_transcript(self, transcript: str, is_final: bool) -> None:
        parts = [make_part(text=transcript, is_final=is_final)]
        await self.host_queue.put(
            {
                "type": "data",
                "provider": self.config.service.provider_name,
                "parts": parts,
            }
        )

    async def _handle_turn(self, data: dict[str, Any]) -> None:

        if "end_of_turn" not in data:
            raise ProviderError("Response missing 'end_of_turn' field.")
        end_of_turn = data["end_of_turn"]

        if "turn_is_formatted" not in data:
            raise ProviderError("Response missing 'turn_is_formatted' field.")
        is_formatted = data["turn_is_formatted"]

        is_final = is_formatted and end_of_turn
        is_partial = not end_of_turn

        if not (is_final or is_partial):
            # There are multiple messages - all combination of end_of_turn and
            # turn_is_formatted. We consider final messages only if they are formatted.
            return

        parts = []
        for word in data.get("words", []):
            word_part = make_part(
                text=word["text"] + " ",
                start_ms=word.get("start"),
                end_ms=word.get("end"),
                confidence=word.get("confidence"),
                is_final=is_final,
            )
            parts.append(word_part)
        if is_final and self.config.params.enable_endpoint_detection == True:
            parts.append(make_part(
                text=" <end>",
                is_final=True,
                start_ms=word.get("start"),
                end_ms=word.get("end"),
                confidence=data.get("end_of_turn_confidence"),
                ))
        await self.host_queue.put(
            {
                "type": "data",
                "provider": self.config.service.provider_name,
                "parts": parts,
            }
        )

    async def _recv_loop(self) -> None:
        try:
            assert (
                self.websocket is not None
            ), "Receive loop called, but socket not initialized."
            async for resp in self.websocket:
                data = json.loads(resp)
                assert isinstance(
                    data, dict
                ), f"json.loads expected to return a dict, got {type(data)}"

                if "error" in data:
                    await self._handle_error(data["error"])
                    break

                if "type" not in data:
                    raise ProviderError("Received message missing 'type' field")

                message_type = data["type"]
                
                if message_type == "Begin":
                    print("AssemblyAI session started.")

                if message_type == "Termination":
                    print("AssemblyAI session terminated.")

                if message_type == "Turn":
                    await self._handle_turn(data)

        except Exception as ex:
            self.error = ex
            await self._handle_error(ex)

    async def _handle_error(self, ex):
        await self.host_queue.put(
            {
                "type": "error",
                "provider": self.config.service.provider_name,
                "error_message": str(ex),
            }
        )
        await self.disconnect()

    @staticmethod
    def get_available_features():
        # Note: streaming Speech-to-Text is only available for English.
        supported = FeatureStatus.supported()
        unsupported = FeatureStatus.unsupported()

        return SupportedFeatures(
            name="AssemblyAI",
            model="Universal",
            single_multilingual_model=FeatureStatus.unsupported(
                comment="Supported for prerecorded audio, not for streaming.",
            ),
            language_hints=unsupported,
            language_identification=FeatureStatus.unsupported(
                comment="Supported for prerecorded audio, not for streaming.",
            ),
            speaker_diarization=FeatureStatus.unsupported(
                comment="Supported for prerecorded audio, not for streaming.",
            ),
            customization=FeatureStatus.unsupported(
                comment="Possible in legacy api using custom vocabulary.",
            ),
            # https://www.assemblyai.com/docs/speech-to-text/universal-streaming
            timestamps=supported,
            # https://www.assemblyai.com/docs/speech-to-text/universal-streaming
            confidence_scores=supported,
            translation_one_way=unsupported,
            translation_two_way=unsupported,
            real_time_latency_config=FeatureStatus.partial(
                comment="Use an audio chunk size of 50ms. Larger chunk sizes "
                "are workable, but may result in latency fluctuations.",
            ),
            # end of turn detection:
            # https://www.assemblyai.com/docs/speech-to-text/universal-streaming
            endpoint_detection=FeatureStatus.supported(
                comment="AssemblyAI’s end-of-turn detection functionality is "
                "integrated into our Streaming STT model, leveraging both acoustic "
                "and semantic features, and is coupled with a traditional "
                "silence-based heuristic approach. Both mechanisms work jointly "
                "and either can trigger end-of-turn detection throughout the "
                "audio stream. ",
            ),
            manual_finalization=FeatureStatus.unsupported(
                comment="Supported in legacy streaming API using ForceEndpoint.",
            ),
        )
