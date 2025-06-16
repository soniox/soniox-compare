import asyncio
import json
import azure.cognitiveservices.speech as speechsdk
from azure.cognitiveservices.speech.languageconfig import AutoDetectSourceLanguageConfig
from providers.base_provider import (
    BaseProvider,
    ProviderError,
)

from azure.cognitiveservices.speech.enums import PropertyId, ResultReason
from azure.cognitiveservices.speech.transcription import ConversationTranscriptionResult
from azure.cognitiveservices.speech.translation import TranslationRecognitionResult
from azure.cognitiveservices.speech.speech import RecognitionResult

from providers.config import (
    FeatureState,
    ProviderConfig,
    SupportedFeatures,
    FeatureStatus,
)
from utils import await_callback, make_part
from typing import Any, Optional
from config import get_language_mapping, get_translation_language_mapping


def _get_start_end_ms(
    result: RecognitionResult,
) -> tuple[int | None, int | None]:
    start_ms = None
    end_ms = None
    if result.offset > 0:
        start_ms = result.offset // 10000
    if start_ms is not None and result.duration > 0:
        end_ms = start_ms + result.duration // 10000
    return start_ms, end_ms


def _get_transcription_language(result: RecognitionResult) -> str | None:
    if (
        PropertyId.SpeechServiceConnection_AutoDetectSourceLanguageResult
        in result.properties
    ):
        return result.properties[
            PropertyId.SpeechServiceConnection_AutoDetectSourceLanguageResult  # noqa
        ]
    return None


def _get_speaker_from_transcription(
    result: ConversationTranscriptionResult,
):
    speaker: str = getattr(result, "speaker_id", None)  # type: ignore
    if speaker != "Unknown":
        speaker = speaker.split("-")[-1]
    return speaker


class AzureProvider(BaseProvider):
    def __init__(self, config: ProviderConfig):
        super().__init__(config)
        self.client_queue: asyncio.Queue[bytes | str] = asyncio.Queue(maxsize=100)
        self.host_queue: asyncio.Queue[dict[str, Any]] = asyncio.Queue()
        self._loop: asyncio.AbstractEventLoop | None = None
        self._sender_task: asyncio.Task[Any] | None = None
        audio_format = speechsdk.audio.AudioStreamFormat(
            samples_per_second=16000, bits_per_sample=16, channels=1
        )
        self.audio_stream = speechsdk.audio.PushAudioInputStream(audio_format)
        self.recognizer: (
            speechsdk.translation.TranslationRecognizer
            | speechsdk.transcription.ConversationTranscriber
            | None
        ) = None

    def _get_speech_config(self):
        speech_config = speechsdk.SpeechConfig(
            subscription=self.config.service.api_key,
            region=self.config.service.region,
        )
        speech_config.set_property(
            speechsdk.PropertyId.Speech_SegmentationStrategy, "Semantic"
        )

        # https://learn.microsoft.com/en-us/answers/questions/2142206/does-real-time-azure-speech-to-text-support-provid
        # result.json contains word level time stamps, but they have to be
        # manually align the lexical word timestamps with the normalized
        # text (DisplayText) by applying inverse text normalization (ITN),
        # capitalization, and punctuation detection to the lexical words.
        # This process can be error-prone and time-consuming.
        # Check _on_transcribing and _on_transcribed functions that parse results.
        # This is the reason we don't enable word level time stamps here.
        # speech_config.request_word_level_timestamps()

        speech_config.output_format = speechsdk.OutputFormat.Detailed
        # if self.config.params.mode == "stt":
        if self.config.params.enable_speaker_diarization:
            speech_config.set_property(
                speechsdk.PropertyId.SpeechServiceResponse_DiarizeIntermediateResults,  # noqa
                "true",
            )

        # Whether you use language identification with speech to text or with speech
        # translation, there are some common concepts and configuration options.
        # Define a list of candidate languages that you expect in the audio.
        # Decide whether to use at-start or continuous language identification.

        # Due to above comment, we disable language identification. It is not possible
        # to identify language without candidate languages.
        # if (
        #    self.config.params.enable_language_identification
        #    or len(self.config.params.language_hints) == 0
        # ):
        #    speech_config.set_property(
        #        speechsdk.PropertyId.SpeechServiceConnection_AutoDetectSourceLanguages,
        #        "true",
        #    )

        return speech_config

    def _get_autodetect_lang_cfg(self) -> AutoDetectSourceLanguageConfig | None:
        lang_mapping = get_language_mapping("azure")

        if len(self.config.params.language_hints) == 0:
            raise ProviderError("Azure does not support multilingual mode.")
        azure_langs = list[str]()

        for lang_hint in self.config.params.language_hints:
            if lang_hint not in lang_mapping:
                raise ProviderError(f"Language {lang_hint} not supported by Azure.")
            azure_langs.append(lang_mapping[lang_hint])  # type: ignore

        return AutoDetectSourceLanguageConfig(languages=azure_langs)

    def _get_source_target_language(self) -> tuple[str, str]:
        assert self.config.params.mode == "mt"
        assert self.config.params.translation is not None

        source_language = self.config.params.translation.source_languages[0]
        target_language = self.config.params.translation.target_language
        lang_mapping = get_translation_language_mapping("azure")
        if source_language not in lang_mapping:
            raise ProviderError("Source language not supported by Azure.")
        source_language = lang_mapping[source_language]

        if target_language not in lang_mapping:
            raise ProviderError("Target language not supported by Azure.")
        target_language = lang_mapping[target_language]
        return source_language, target_language

    async def connect(self) -> None:
        if self._is_connected:
            return
        self.validate_provider_capabilities(config=self.config)
        try:
            # Clear errors when trying to start new connection.
            self.error = None
            speech_config = self._get_speech_config()
            audio_config = speechsdk.AudioConfig(stream=self.audio_stream)
            if self.config.params.mode == "stt":

                auto_detect_lang_cfg = self._get_autodetect_lang_cfg()

                self.recognizer = speechsdk.transcription.ConversationTranscriber(
                    speech_config=speech_config,
                    audio_config=audio_config,
                    language=None,
                    source_language_config=None,
                    auto_detect_source_language_config=auto_detect_lang_cfg,
                )

                self.recognizer.transcribing.connect(self._on_transcribing)
                self.recognizer.transcribed.connect(self._on_transcribed)
                self.recognizer.canceled.connect(self._on_canceled)
                self.recognizer.start_transcribing_async()

            elif self.config.params.mode == "mt":
                assert (
                    self.config.params.translation is not None
                ), "Translation mode, but translation config is None."

                translation_config = speechsdk.translation.SpeechTranslationConfig(
                    subscription=self.config.service.api_key,
                    region=self.config.service.region,
                )
                if len(self.config.params.translation.source_languages) != 1:
                    raise ProviderError(
                        "Azure only supports single " "source language for translation."
                    )

                source, target = self._get_source_target_language()

                self.config.params.translation.target_language = target
                self.config.params.translation.source_languages = [source]

                translation_config.speech_recognition_language = source
                translation_config.add_target_language(target)

                self.recognizer = speechsdk.translation.TranslationRecognizer(
                    translation_config=translation_config,
                    audio_config=audio_config,
                )
                self.recognizer.recognizing.connect(self._on_recognizing)
                self.recognizer.recognized.connect(self._on_recognized)
                self.recognizer.canceled.connect(self._on_canceled)
                self.recognizer.start_continuous_recognition_async()
            else:
                raise ProviderError(
                    f"Unsupported mode: {self.config.params.mode}, "
                    "options are 'stt' or 'mt'."
                )
            self._loop = asyncio.get_running_loop()
            self._is_connected = True
            self._sender_task = asyncio.create_task(self._send_loop())

        except Exception as ex:
            self.error = ex
            raise ProviderError(f"{str(ex)}")

    async def disconnect(self) -> None:
        self._is_connected = False
        if self._sender_task:
            self._sender_task.cancel()
        if self.audio_stream:
            try:
                self.audio_stream.close()
            except Exception as ex:
                self.error = ex
                pass
        if self.recognizer:
            try:
                if self.config.params.mode == "stt":
                    await await_callback(
                        self.recognizer.stop_transcribing_async, timeout=5
                    )
                else:
                    await await_callback(
                        self.recognizer.stop_continuous_recognition_async, timeout=5
                    )
            except Exception as ex:
                self.error = ex
                pass

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
        await self.client_queue.put(b"")

    async def receive(self) -> list[dict[str, Any]]:
        items = []
        while not self.host_queue.empty():
            items.append(await self.host_queue.get())
        return items

    async def _send_loop(self):
        while self._is_connected:
            data = await self.client_queue.get()
            if isinstance(data, bytes) and data != b"":
                self.audio_stream.write(data)
            elif data == b"":  # End-of-stream signal
                try:
                    self.audio_stream.close()
                except Exception as ex:
                    self.error = ex
                    pass
                break

    # --- Event handlers for TranslationRecognizer (MT mode) ---
    # Azure SDK calls these callbacks from non-async threads
    def _process_translation_result(
        self, result: TranslationRecognitionResult, is_final: bool, append_text: str
    ) -> None:
        try:
            if self._loop:
                assert (
                    self.config.params.translation is not None
                ), "Translation config is None, but received translation result."
    
                language = self.config.params.translation.target_language
                start_ms, end_ms = _get_start_end_ms(result)
                text = result.translations.get(language, "") + append_text
                start_ms, end_ms = _get_start_end_ms(result)
                
                if text:
                    part = make_part(
                        text=text,
                        is_final=is_final,
                        start_ms=start_ms,
                        end_ms=end_ms,
                        language=(
                            language
                        ),
                    )
                    assert (
                        self._loop is not None
                    ), "Received translation result, but event loop not initialized."
                    asyncio.run_coroutine_threadsafe(
                        self._handle_result([part]), self._loop
                    )
        except Exception as e:
            self.error = e
            raise ProviderError(f"{e}")

    # --- Event handlers for TranslationRecognizer (MT mode) ---
    # Azure SDK calls these callbacks from non-async threads
    def _on_recognizing(self, evt):
        assert self.config.params.mode == "mt", "_on_recognizing called in non-mt mode."
        self._process_translation_result(evt.result, is_final=False, append_text="")

    def _on_recognized(self, evt):
        assert self.config.params.mode == "mt", "_on_recognized called in non-mt mode."
        self._process_translation_result(evt.result, is_final=True, append_text=" ")

    # --- Event handlers for ConversationTranscriber (STT mode) ---

    def _on_transcribing(self, evt):
        if self._loop:
            result: ConversationTranscriptionResult = evt.result

            start_ms = None
            end_ms = None
            text = getattr(result, "text", "")
            if not text:
                return
            start_ms, end_ms = _get_start_end_ms(result)

            speaker = None
            if self.config.params.enable_speaker_diarization:
                speaker = _get_speaker_from_transcription(result)

            language = None
            if self.config.params.enable_language_identification:
                language = _get_transcription_language(result)

            is_final = False
            part = make_part(
                text=text,
                is_final=is_final,
                start_ms=start_ms,
                end_ms=end_ms,
                speaker=speaker,
                language=language,
            )
            asyncio.run_coroutine_threadsafe(self._handle_result([part]), self._loop)

    def _on_transcribed(self, evt):
        if self._loop:
            result: ConversationTranscriptionResult = evt.result
            text = result.text
            if not text:
                return

            confidence = None
            try:
                result_dict = json.loads(evt.result.json)
                if "NBest" in result_dict and result_dict["NBest"]:
                    confidence = result_dict["NBest"][0].get("Confidence")

                start_ms, end_ms = _get_start_end_ms(evt.result)
                speaker = None
                if self.config.params.enable_speaker_diarization:
                    speaker = _get_speaker_from_transcription(evt.result)

                language = None
                if self.config.params.enable_language_identification:
                    language = _get_transcription_language(result)

                part1 = make_part(
                    text=(text + " "),
                    confidence=confidence,
                    is_final=True,
                    start_ms=start_ms,
                    end_ms=end_ms,
                    speaker=speaker,
                    language=language,
                )
                parts = [part1]
                if self.config.params.enable_endpoint_detection == True:
                    part2 = make_part(
                        text = " <end>",
                        confidence=confidence,
                        is_final=True,
                        start_ms=start_ms,
                        end_ms=end_ms,
                        speaker=speaker,
                        language=language,
                        )
                    parts.append(part2)
                asyncio.run_coroutine_threadsafe(
                    self._handle_result(parts), self._loop
                )

            except Exception as ex:
                self.error = ex
                raise ProviderError(
                    f"Error parsing ConversationTranscriber result JSON: {ex}"
                )

    def _on_canceled(self, evt):
        error = evt.error_details or "Recognition canceled"
        if self._loop:
            asyncio.run_coroutine_threadsafe(self._handle_error(error), self._loop)

    async def _handle_result(self, parts):
        await self.host_queue.put(
            {
                "type": "data",
                "provider": self.config.service.provider_name,
                "parts": parts,               
            }
        )

    async def _handle_error(self, ex):
        await self.host_queue.put(
            {
                "type": "error",
                "provider": self.config.service.provider_name,
                "error_message": str(ex),
            }
        )
        await self.disconnect()

    def validate_provider_capabilities(self, config: Any) -> None:
        # This calls the shared helper from BaseProvider
        self._validate_capabilities_helper(config=config, provider="Azure")

    def _validate_capabilities_helper(self, config: Any, provider: str) -> None:

        features = self.get_available_features()
        if (
            config.params.mode == "mt"
            and features.translation_one_way.state == FeatureState.UNSUPPORTED
        ):
            raise ProviderError(f"Machine translation is not supported by {provider}.")

        # Allow speaker diarization only in stt mode
        if config.params.enable_speaker_diarization and config.params.mode != "stt":
            raise ProviderError(
                "Azure only supports speaker diarization in 'stt' mode."
                "\n[Click here to read more.](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/get-started-stt-diarization?tabs=linux&pivots=programming-language-python)"
            )

        if (
            config.params.enable_language_identification
            and features.language_identification.state == FeatureState.UNSUPPORTED
        ):
            raise ProviderError(f"Language identification not supported by {provider}.")

        if (
            config.params.enable_endpoint_detection
            and features.endpoint_detection.state == FeatureState.UNSUPPORTED
        ):
            raise ProviderError(f"Endpoint detection not supported by {provider}.")

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
        supported = FeatureStatus.supported()
        unsupported = FeatureStatus.unsupported()
        partial = FeatureStatus.partial()
        return SupportedFeatures(
            name="Azure",
            model="en-US-Conversation",
            single_multilingual_model=unsupported,  # TODO: Check if this is correct
            language_hints=unsupported,  # TODO: Check if this is correct
            language_identification=partial,  # https://learn.microsoft.com/en-us/azure/ai-services/speech-service/language-identification?tabs=once&pivots=programming-language-csharp # noqa
            speaker_diarization=partial,  # NOTE: Only for transcription, not translation https://learn.microsoft.com/en-us/azure/ai-services/speech-service/get-started-stt-diarization?tabs=linux&pivots=programming-language-csharp # noqa
            customization=supported,  # https://learn.microsoft.com/en-us/azure/ai-services/speech-service/improve-accuracy-phrase-list?tabs=terminal&pivots=programming-language-csharp # noqa
            timestamps=supported,  # ADDED https://learn.microsoft.com/en-us/azure/ai-services/speech-service/get-speech-recognition-results?pivots=programming-language-csharp # noqa
            confidence_scores=supported,  # ADDED https://learn.microsoft.com/en-us/azure/ai-services/speech-service/get-speech-recognition-results?pivots=programming-language-csharp # noqa
            translation_one_way=supported,
            translation_two_way=unsupported,
            real_time_latency_config=supported,  # Speech_SegmentationSilenceTimeoutMs and SpeechServiceConnection_InitialSilenceTimeoutMs, https://learn.microsoft.com/en-us/dotnet/api/microsoft.cognitiveservices.speech.propertyid?view=azure-dotnet # noqa
            # https://learn.microsoft.com/en-us/azure/ai-services/speech-service/how-to-recognize-speech?pivots=programming-language-csharp # noqa
            endpoint_detection=FeatureStatus.supported(
                comment="Either based on timeouts or based on semantic "
                "segmentation - look for Semantic segmentation.",
            ),
            manual_finalization=unsupported,
        )
