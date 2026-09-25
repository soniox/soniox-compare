import asyncio
import json
import websockets
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

from config import get_language_mapping


class SpeechmaticsProvider(BaseProvider):
    name = "speechmatics"

    def __init__(self, config: ProviderConfig):
        super().__init__(config)
        self.config = config
        self.websocket: websockets.ClientConnection | None = None
        self.client_queue: asyncio.Queue[bytes | str] = asyncio.Queue(maxsize=100)
        self._sender: asyncio.Task[Any] | None = None
        self._receiver: asyncio.Task[Any] | None = None
        self._num_sent_chunks = 0
        self.first_word: bool = True

    async def connect(self) -> None:
        if self._is_connected:
            return

        warnings = self.validate_provider_capabilities("Speechmatics")
        for warning in warnings:
            await self.host_queue.put(warning)

        if self.config.params.enable_language_identification:
            raise ProviderError(
                "Speechmatics only supports language identification in batch, not streaming."
                "\n[Click here for more info](https://docs.speechmatics.com/features-other/lang-id)"
            )
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
        """Choose appropriate transcription language."""

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
        # Send Speechmatics' own code, which differs from our canonical hint for a
        # few languages (e.g. our "zh" -> Speechmatics "cmn").
        return self._stt_language_pairs[hint]

    def _build_config_message(
        self, language: str, audio_format: dict[str, Any]
    ) -> dict[str, Any]:
        """Construct the initial StartRecognition message."""
        transcription = {
            "language": language,
            "model": "enhanced",
            "max_delay": self.config.params.options["max_delay"],
            "enable_partials": True,
        }
        if self.config.params.enable_speaker_diarization:
            transcription["diarization"] = "speaker"
        if not self.config.params.options["punctuation"]:
            # Punctuation is on by default; an empty permitted-marks list is
            # how this API turns it off.
            transcription["punctuation_overrides"] = {"permitted_marks": []}

        msg = {
            "message": "StartRecognition",
            "audio_format": audio_format,
            "transcription_config": transcription,
        }

        return msg

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
            await self.disconnect()
            raise ProviderError("Queue full: disconnecting.")

    async def send_end(self) -> None:
        end_msg = {"message": "EndOfStream", "last_seq_no": self._num_sent_chunks}
        self.client_queue.put_nowait(json.dumps(end_msg))


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
                self.emit_raw(resp)
                data = json.loads(resp)
                msg_type = data.get("message")
                if msg_type in (
                    "AddPartialTranscript",
                    "AddTranscript",
                ):
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
                                "provider": self.name,
                                "parts": parts,
                            }
                        )

                elif msg_type == "Error":
                    err_type = data.get("type") or "unknown_error"
                    reason = data.get("reason") or "Unknown error"
                    await self._error(f"Speechmatics [{err_type}]: {reason}")
        except Exception as ex:
            self.error = ex
            await self._error(ex)

    async def _error(self, ex):
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
        # Single multilingual model.
        # Note from website: "Please note, this is currently only supported with Batch Transcriptions."
        supported = FeatureStatus.supported()
        unsupported = FeatureStatus.unsupported()
        return SupportedFeatures(
            name="Speechmatics",
            model="enhanced",
            single_multilingual_model=unsupported,
            language_hints=unsupported,  # But language can be selected or default language can be used.
            language_identification=unsupported,  # https://docs.speechmatics.com/features-other/lang-id
            speaker_diarization=supported,  # https://docs.speechmatics.com/features/diarization
            customization=supported,  # https://docs.speechmatics.com/features/custom-dictionary
            timestamps=supported,  # https://docs.speechmatics.com/features-other/word-alignment
            confidence_scores=supported,  # https://docs.speechmatics.com/features/entities#example-transcription-output
            real_time_latency_config=supported,  # https://docs.speechmatics.com/features/realtime-latency
            # Seconds the recognizer buffers before finalizing a transcript:
            # lower is faster, higher is more accurate.
            options={
                "max_delay": ProviderOption(
                    default=2.0,
                    comment="Seconds the recognizer may buffer before it has to "
                    "finalize: lower is faster, higher is more accurate.",
                ),
                "punctuation": ProviderOption(
                    default=False,
                    comment="Punctuation is on at Speechmatics; off sends an "
                    "empty permitted-marks list, which is how it is disabled.",
                ),
            },
            text_formatting=FeatureStatus.supported(
                comment="Punctuation is removed via `punctuation_overrides` when the setting is off.",
            ),
            endpoint_detection=unsupported,  # True previously, but could not find this feature.
            manual_finalization=unsupported,
        )
