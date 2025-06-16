import asyncio
import json
import websockets
from providers.base_provider import (
    BaseProvider,
    ProviderError,
)
from providers.config import ProviderConfig, SupportedFeatures, FeatureStatus
from utils import make_part
from typing import Any, Optional

from config import get_translation_language_mapping, get_language_mapping


class SpeechmaticsProvider(BaseProvider):
    def __init__(self, config: ProviderConfig):
        super().__init__(config)
        self.config = config
        self.websocket: websockets.ClientConnection | None = None
        self.client_queue: asyncio.Queue[bytes | str] = asyncio.Queue(maxsize=100)
        self.host_queue: asyncio.Queue[dict[str, Any]] = asyncio.Queue()
        self._sender: asyncio.Task[Any] | None = None
        self._receiver: asyncio.Task[Any] | None = None
        self._num_sent_chunks = 0
        self.first_word: bool = True

    async def connect(self) -> None:
        if self._is_connected:
            return
        self.validate_provider_capabilities("Speechmatics")
        if self.config.params.mode == "mt":
            translation = self.config.params.translation
            self._session_target_language = translation.target_language.replace(
                "zh", "cmn"
            )
        else:
            self._session_target_language = None
        try:
            self.error = None
            headers = {"Authorization": f"Bearer {self.config.service.api_key}"}
            self.websocket = await websockets.connect(
                self.config.service.websocket_url, additional_headers=headers
            )

            language = self._determine_language()

            audio_format = {
                "type": "raw",
                "encoding": self.config.common.audio_format,
                "sample_rate": self.config.common.sample_rate,
            }

            config_message = self._build_config_message(language, audio_format)
            await self.websocket.send(json.dumps(config_message))

            self._is_connected = True
            self._num_sent_chunks = 0
            self._sender = asyncio.create_task(self._send_loop())
            self._receiver = asyncio.create_task(self._recv_loop())

        except Exception as ex:
            raise ProviderError(f"{ex}")

    def _determine_language(self) -> str:
        """Choose appropriate language based on mode (STT or MT)."""

        if self.config.params.mode == "mt":
            translation = self.config.params.translation
            if not translation:
                raise ProviderError("Got mt mode, but translation config is None.")
            if len(translation.source_languages) != 1:
                raise ProviderError(
                    "Speechmatics supports only one source language for translation."
                )
            return translation.source_languages[0]

        if not self.config.params.language_hints:
            raise ProviderError(
                "Speechmatics provider does not support multilingual mode."
            )
        self._stt_language_pairs = get_language_mapping("speechmatics")
        hint = self.config.params.language_hints[0]
        if hint not in self._stt_language_pairs:
            raise ProviderError(
                "Speechmatics does not support real-time transcription in this language."
            )
        return hint

    def _build_config_message(
        self, language: str, audio_format: dict[str, Any]
    ) -> dict[str, Any]:
        """Construct the initial StartRecognition message."""
        transcription = {
            "language": language,
            "operating_point": "enhanced",
            "max_delay": 2.0,
            "enable_partials": True,
        }
        if self.config.params.enable_speaker_diarization:
            transcription["diarization"] = "speaker"

        msg = {
            "message": "StartRecognition",
            "audio_format": audio_format,
            "transcription_config": transcription,
        }

        if self.config.params.mode == "mt":
            translation = self.config.params.translation
            assert translation is not None
            self._language_pairs = get_translation_language_mapping("speechmatics")

            # Normalize Chinese language code
            translation.source_languages[0] = translation.source_languages[0].replace(
                "zh", "cmn"
            )
            translation.target_language = translation.target_language.replace(
                "zh", "cmn"
            )

            if not self.is_language_pair_supported(
                translation.source_languages, translation.target_language
            ):
                raise ProviderError(
                    f"Unsupported language pair: {translation.source_languages[0]} -> {translation.target_language}."
                    "\n[Click here to see available languages.](https://docs.speechmatics.com/introduction/supported-languages)"
                )

            msg["translation_config"] = {
                "target_languages": [translation.target_language],
                "enable_partials": True,
            }

        return msg

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
        end_msg = {"message": "EndOfStream", "last_seq_no": self._num_sent_chunks}
        self.client_queue.put_nowait(json.dumps(end_msg))

    async def receive(self) -> list[dict[str, Any]]:
        items = []
        while not self.host_queue.empty():
            items.append(await self.host_queue.get())
        return items

    async def _send_loop(self):
        while self._is_connected:
            msg = await self.client_queue.get()
            if not self.websocket:
                break
            try:
                await self.websocket.send(msg)
                self._num_sent_chunks += 1
            except Exception as ex:
                self.error = ex
                await self._error(ex)
                break

    async def _recv_loop(self):
        try:
            async for resp in self.websocket:
                data = json.loads(resp)
                # Parse transcripts & translations accordingly
                msg_type = data.get("message")
                if self.config.params.mode == "stt" and msg_type in (
                    "AddPartialTranscript",
                    "AddTranscript",
                ):
                    # transcript = data.get("metadata", {}).get("transcript", "")
                    is_final = msg_type == "AddTranscript"
                    parts = []

                    results = data.get("results", [])
                    for result in results:
                        start_time_s = result.get("start_time")
                        end_time_s = result.get("end_time")
                        content_type = result.get("type")

                        alternatives = result.get("alternatives", [])
                        confidence = None
                        text = ""
                        language = None
                        speaker = None
                        if len(alternatives) > 0:
                            word_props = alternatives[0]
                            text = word_props.get("content")
                            confidence = word_props.get("confidence")
                            if word_props.get("speaker") is not None:
                                speaker = word_props.get("speaker")[-1]

                            if self.first_word and content_type == "word":
                                self.first_word = False

                            if not self.first_word and content_type == "word":
                                text = " " + text
                        parts.append(
                            make_part(
                                text=text,
                                is_final=is_final,
                                speaker=speaker,
                                language=language,
                                start_ms=start_time_s * 1000,
                                end_ms=end_time_s * 1000,
                                confidence=confidence,
                            )
                        )

                    if len(parts) > 0:
                        await self.host_queue.put(
                            {
                                "type": "data",
                                "provider": self.config.service.provider_name,
                                "parts": parts,
                            }
                        )

                elif self.config.params.mode == "mt" and msg_type in (
                    "AddPartialTranslation",
                    "AddTranslation",
                ):
                    translations = data.get("results", [])
                    is_final = msg_type == "AddTranslation"

                    parts = []

                    for translation in translations:
                        content = translation.get("content")
                        speaker = None
                        start_time_s = translation.get("start_time")
                        end_time_s = translation.get("end_time")
                        if msg_type == "AddTranslation":
                            if translation.get("speaker") is not None:
                                speaker = translation.get("speaker")[-1]

                        assert isinstance(content, str)
                        content = content.strip()

                        if is_final:
                            content += " "
                        parts.append(
                            make_part(
                                text=content,
                                is_final=is_final,
                                speaker=speaker,
                                start_ms=start_time_s * 1000,
                                end_ms=end_time_s * 1000,
                                language=self._session_target_language,
                            )
                        )
                    if len(parts) > 0:
                        await self.host_queue.put(
                            {
                                "type": "data",
                                "provider": self.config.service.provider_name,
                                "parts": parts,
                            }
                        )
                elif msg_type == "error":
                    await self._error(data.get("error", "Unknown error"))
        except Exception as ex:
            self.error = ex
            await self._error(ex)

    async def _error(self, ex):
        await self.host_queue.put(
            {
                "type": "error",
                "provider": self.config.service.provider_name,
                "error_message": str(ex),
            }
        )
        await self.disconnect()

    def is_language_pair_supported(
        self, source_langs: Optional[list[str]], target_lang: str
    ) -> bool:
        if not source_langs or not target_lang:
            return False
        for src in source_langs:
            if target_lang in self._language_pairs.get(src, []):
                return True
        return False

    @staticmethod
    def get_available_features():
        # Single multilingual model.
        # Note from website: "Please note, this is currently only supported with Batch Transcriptions."
        supported = FeatureStatus.supported()
        unsupported = FeatureStatus.unsupported()
        return SupportedFeatures(
            name="Speechmatics",
            model="realtime-enhanced",
            single_multilingual_model=unsupported,
            language_hints=unsupported,  # But language can be selected or default language can be used.
            language_identification=unsupported,  # https://docs.speechmatics.com/features-other/lang-id
            speaker_diarization=supported,  # https://docs.speechmatics.com/features/diarization
            customization=supported,  # https://docs.speechmatics.com/features/custom-dictionary
            timestamps=supported,  # https://docs.speechmatics.com/features-other/word-alignment
            confidence_scores=supported,  # https://docs.speechmatics.com/features/entities#example-transcription-output
            translation_one_way=supported,  # https://docs.speechmatics.com/features-other/translation
            translation_two_way=unsupported,
            real_time_latency_config=supported,  # https://docs.speechmatics.com/features/realtime-latency
            endpoint_detection=FeatureStatus.partial(),  # True previously, but could not find this feature.
            manual_finalization=unsupported,
        )
