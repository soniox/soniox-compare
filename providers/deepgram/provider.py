import asyncio
import websockets
import json
from providers.base_provider import (
    BaseProvider,
    ProviderError,
    validate_capabilities,
)
from providers.config import ProviderConfig, SupportedFeatures, FeatureStatus
from utils import make_part
from typing import Any
from urllib.parse import urlencode
from config import get_language_mapping


class DeepgramProvider(BaseProvider):
    def __init__(self, config: ProviderConfig):
        super().__init__(config)
        self.websocket: websockets.ClientConnection | None = None
        self.client_queue: asyncio.Queue[bytes | str] = asyncio.Queue(maxsize=100)
        self.host_queue: asyncio.Queue[dict[str, Any]] = asyncio.Queue()
        self._sender: asyncio.Task[Any] | None = None
        self._receiver: asyncio.Task[Any] | None = None
        self._first_word = True

    def get_lang_cfg(self) -> str:
        language = "en"
        lang_mapping = get_language_mapping("deepgram")
        if len(self.config.params.language_hints) == 0:
            language = "multi"

        for lang_hint in self.config.params.language_hints:
            if lang_hint not in lang_mapping:
                raise ProviderError(f"Language {lang_hint} not supported by Deepgram.")
            elif lang_hint != "en":
                language = "multi"
                break
        return language

    async def connect(self) -> None:
        if self._is_connected:
            return
        try:
            self.error = None
            headers = {"Authorization": f"token {self.config.service.api_key}"}
            # detect_language does not work, although it is documented.
            # API returns an error.
            if (
                self.config.params.enable_language_identification
                and self.get_available_features().language_identification.state
                != FeatureStatus.unsupported()
            ):
                raise ProviderError(
                    f"Deepgram only supports language identification in batch, not streaming."
                    "\n[Click here for more info](https://developers.deepgram.com/docs/language-detection)"
                )
            self.validate_provider_capabilities("Deepgram")
            language = self.get_lang_cfg()

            endpointing: int | str = "false"
            if self.config.params.enable_endpoint_detection:
                endpointing = 500
                if language == "multi":
                    endpointing = 100

            # Note that punctuation does not work.
            # https://github.com/deepgram/deepgram-js-sdk/issues/386
            url_params_dict = {
                "language": language,
                "model": self.config.service.model,
                "punctuate": "true",
                "interim_results": "true",
                "encoding": "linear16",
                "sample_rate": self.config.common.sample_rate,
                "diarize": (
                    "true" if self.config.params.enable_speaker_diarization else "false"
                ),
                "utterances": "true",
                "dictation": "true",
                "numerals": "true",
                "smart_format": "true",
                "measurements": "true",
                "endpointing": endpointing,
            }

            query_string = urlencode(url_params_dict)
            full_url = f"{self.config.service.websocket_url}?{query_string}"

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
        if self.websocket:
            end_msg = json.dumps({"type": "end"})
            self.client_queue.put_nowait(end_msg)

    async def receive(self) -> list[dict[str, Any]]:
        items = []
        while not self.host_queue.empty():
            items.append(await self.host_queue.get())
        return items

    async def _send_loop(self):
        while self._is_connected:
            data = await self.client_queue.get()
            if not self.websocket:
                break
            try:
                await self.websocket.send(data)
            except Exception as ex:
                self.error = ex
                await self._handle_error(f"Sender error: {ex}")
                break

    async def _recv_loop(self):
        try:
            async for msg in self.websocket:
                data = json.loads(msg)
                if (
                    "channel" in data
                    and "alternatives" in data["channel"]
                    and len(data["channel"]["alternatives"]) > 0
                    and "is_final" in data
                ):
                    data_part = data["channel"]["alternatives"][0]
                    is_final = data["is_final"]
                    if "words" in data_part:
                        words = data_part["words"]
                        parts = []
                        for word in words:
                            if self.config.params.enable_speaker_diarization:
                                speaker = word.get("speaker", "UNKNOWN")
                                if speaker != "UNKNOWN":
                                    speaker += 1
                            else:
                                speaker = None

                            start_s = word.get("start")
                            start_ms = int(start_s * 1000) if start_s is None else None

                            end_s = word.get("end")
                            end_ms = int(end_s * 1000) if end_s is None else None

                            confidence = word.get("confidence")

                            if self._first_word:
                                text = word["punctuated_word"]
                                self._first_word = False
                            else:
                                text = " " + word["punctuated_word"]

                            parts.append(
                                make_part(
                                    text=text,
                                    is_final=is_final,
                                    speaker=speaker,
                                    language=None,
                                    start_ms=start_ms,
                                    end_ms=end_ms,
                                    confidence=confidence,
                                )
                            )
                        if data.get("speech_final") is True:
                            parts.append(
                                make_part(
                                    text=" <end>",
                                    is_final=True,
                                    speaker=speaker,
                                    language=None,
                                    start_ms=start_ms,
                                    end_ms=end_ms,
                                    confidence=None,
                                )
                            )

                        part = {
                            "type": "data",
                            "provider": self.config.service.provider_name,
                            "parts": parts,
                        }
                        await self.host_queue.put(part)

                elif "error" in data:
                    await self._handle_error(data["error"])
        except Exception as ex:
            self.error = ex
            await self._handle_error(f"Receiver error: {ex}")

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
        # Single multilingual model
        supported = FeatureStatus.supported()
        unsupported = FeatureStatus.unsupported()
        return SupportedFeatures(
            name="Deepgram",
            model="nova-3",
            single_multilingual_model=supported,
            language_hints=unsupported,
            language_identification=FeatureStatus.unsupported(
                comment="Not for streaming, only for prerecorded.",
            ),  # https://developers.deepgram.com/docs/language-detection
            # https://developers.deepgram.com/docs/diarization
            speaker_diarization=supported,  # sometimes it just doesn't work
            customization=supported,  # available in form of Keyterm Prompting: https://developers.deepgram.com/docs/keyterm
            timestamps=supported,
            confidence_scores=supported,
            translation_one_way=unsupported,
            translation_two_way=unsupported,
            # Endpointing can affect the latency, but only when it actually detects
            # silence in audio stream. We set this to false.
            real_time_latency_config=unsupported,
            endpoint_detection=FeatureStatus.supported(
                comment="Endpoint detection based on pre-determined silence duration. "
                "This does not take into account the context and crucially, it is not "
                "the model that decides whether the endpoint has been reached.",
            ),  # https://developers.deepgram.com/docs/endpointing #partial!!!!
            manual_finalization=supported,
        )
