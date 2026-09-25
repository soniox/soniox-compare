import asyncio
import websockets
import json
from providers.base import (
    BaseProvider,
    ProviderError,
)
from providers.config import (
    FeatureStatus,
    ProviderConfig,
    ProviderOption,
    SupportedFeatures,
)
from utils import make_part
from typing import Any
from urllib.parse import urlencode
from config import get_language_mapping


class DeepgramProvider(BaseProvider):
    name = "deepgram"

    def __init__(self, config: ProviderConfig):
        super().__init__(config)
        self.websocket: websockets.ClientConnection | None = None
        self.client_queue: asyncio.Queue[bytes | str] = asyncio.Queue(maxsize=100)
        self._sender: asyncio.Task[Any] | None = None
        self._receiver: asyncio.Task[Any] | None = None

    def get_lang_cfg(self) -> str:
        hints = self.config.params.language_hints
        if len(hints) == 0:
            return "multi"  # no hint → multilingual code-switching

        lang_mapping = get_language_mapping("deepgram")
        lang_hint = hints[0]
        if lang_hint not in lang_mapping:
            raise ProviderError(f"Language {lang_hint} not supported by Deepgram.")
        return lang_mapping[lang_hint]

    async def connect(self) -> None:
        if self._is_connected:
            return

        warnings = self.validate_provider_capabilities("Deepgram")
        for warning in warnings:
            await self.host_queue.put(warning)

        try:
            self.error = None
            headers = {"Authorization": f"token {self.config.service.api_key}"}
            language = self.get_lang_cfg()

            endpointing: int | str = "false"
            if self.config.params.enable_endpoint_detection:
                endpointing = 500
                if language == "multi":
                    endpointing = 100

            # `smart_format` covers casing, punctuation and number formatting.
            # `dictation` is not compatible with it: it switches the model to
            # spoken punctuation commands ("comma" -> ","), which turns normal
            # casing and punctuation off entirely. `numerals` alongside it
            # splits years ("2026" -> "20 26").
            url_params_dict = {
                "language": language,
                "model": self.config.service.model,
                "interim_results": "true",
                "encoding": "linear16",
                "sample_rate": self.config.common.sample_rate,
                "diarize": (
                    "true" if self.config.params.enable_speaker_diarization else "false"
                ),
                "endpointing": endpointing,
            }
            if self.config.params.options["smart_format"]:
                url_params_dict["smart_format"] = "true"
                url_params_dict["measurements"] = "true"

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
        # Deepgram finalizes a live stream via the "CloseStream" control message.
        # It makes the server flush any buffered audio, emit the final results
        # (with is_final/speech_final set), send summary metadata, and then close.
        # Without it, trailing interim words never get finalized.
        # https://developers.deepgram.com/docs/close-stream
        if self.websocket:
            end_msg = json.dumps({"type": "CloseStream"})
            self.client_queue.put_nowait(end_msg)


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
                self.emit_raw(msg)
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
                        speaker = None
                        start_ms = None
                        end_ms = None
                        for word in words:
                            if self.config.params.enable_speaker_diarization:
                                raw_speaker = word.get("speaker")
                                # Deepgram speakers are 0-indexed ints; expose them
                                # 1-indexed and drop entries without a speaker.
                                speaker = (
                                    raw_speaker + 1 if raw_speaker is not None else None
                                )
                            else:
                                speaker = None

                            start_s = word.get("start")
                            start_ms = (
                                int(start_s * 1000) if start_s is not None else None
                            )

                            end_s = word.get("end")
                            end_ms = int(end_s * 1000) if end_s is not None else None

                            confidence = word.get("confidence")
                            text = word.get("punctuated_word") or word.get("word", "")

                            parts.append(
                                make_part(
                                    text=text + " ",
                                    is_final=is_final,
                                    speaker=speaker,
                                    language=None,
                                    start_ms=start_ms,
                                    end_ms=end_ms,
                                    confidence=confidence,
                                )
                            )
                        # Only emit an endpoint marker for endpoints detected during
                        # live speech. The flush triggered by CloseStream/Finalize is
                        # tagged with `from_finalize` and would otherwise add a
                        # duplicate <end> at the very end of the stream.
                        if (
                            self.config.params.enable_endpoint_detection
                            and data.get("speech_final") is True
                            and not data.get("from_finalize")
                        ):
                            parts.append(
                                make_part(
                                    text="<end>",
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
                            "provider": self.name,
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
                "provider": self.name,
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
            # `language=multi` covers 10 languages, far fewer than the 54 it
            # accepts as a hint, so keep a hint rather than falling back to it.
            auto_detect_covers_all_languages=False,
            language_hints=unsupported,
            language_identification=unsupported,  # https://developers.deepgram.com/docs/language-detection
            # https://developers.deepgram.com/docs/diarization
            speaker_diarization=supported,  # sometimes it just doesn't work
            customization=supported,  # available in form of Keyterm Prompting: https://developers.deepgram.com/docs/keyterm
            timestamps=supported,
            confidence_scores=supported,
            # `endpointing` is the silence timeout behind endpoint detection; it
            # is sent as a fixed value (see connect), never as a user setting.
            real_time_latency_config=unsupported,
            endpoint_detection=FeatureStatus.partial(
                comment="Endpoint detection based on pre-determined silence duration. "
                "This does not take into account the context. Therefore it is not "
                "the model that decides whether the endpoint has been reached.",
            ),  # https://developers.deepgram.com/docs/endpointing #partial!!!!
            manual_finalization=supported,
            # Casing, punctuation and number formatting.
            options={
                "smart_format": ProviderOption(
                    default=False,
                    comment="Casing, punctuation and number formatting; also "
                    "sends `measurements`. Deepgram leaves it off unless asked.",
                )
            },
            text_formatting=FeatureStatus.supported(
                comment="`smart_format` adds punctuation, casing and number "
                "formatting when the setting is on.",
            ),
        )
