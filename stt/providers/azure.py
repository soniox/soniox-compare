import asyncio
import json
import azure.cognitiveservices.speech as speechsdk
from azure.cognitiveservices.speech.languageconfig import AutoDetectSourceLanguageConfig
from providers.base import (
    BaseProvider,
    ProviderError,
)

from azure.cognitiveservices.speech.enums import PropertyId
from azure.cognitiveservices.speech.transcription import ConversationTranscriptionResult
from azure.cognitiveservices.speech.speech import RecognitionResult

from providers.config import (
    FeatureStatus,
    ProviderConfig,
    ProviderOption,
    SupportedFeatures,
)
from utils import await_callback, make_part
from typing import Any, Optional
from config import get_language_mapping


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
    name = "azure"

    def __init__(self, config: ProviderConfig):
        super().__init__(config)
        self.client_queue: asyncio.Queue[bytes | str] = asyncio.Queue(maxsize=100)
        self._loop: asyncio.AbstractEventLoop | None = None
        self._sender_task: Optional[asyncio.Task] = None
        self._receiver_task: Optional[asyncio.Task] = None
        audio_format = speechsdk.audio.AudioStreamFormat(
            samples_per_second=16000, bits_per_sample=16, channels=1
        )
        self.audio_stream = speechsdk.audio.PushAudioInputStream(audio_format)
        # ConversationTranscriber is Azure's diarizing recognizer, and Azure
        # bills its "enhanced feature" add-on for every session that uses it.
        # With diarization off we use the plain recognizer instead, so the
        # session is not charged for a feature nobody asked for.
        self.recognizer: (
            speechsdk.transcription.ConversationTranscriber
            | speechsdk.SpeechRecognizer
            | None
        ) = None

    def _get_speech_config(self):
        if not self.config.service.api_key:
            raise ProviderError("Azure API key is not set. Set AZURE_API_KEY.")
        if not self.config.service.region:
            raise ProviderError(
                "Azure region is not set. Set AZURE_REGION (e.g. 'eastus')."
            )
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
        if self.config.params.enable_speaker_diarization:
            speech_config.set_property(
                speechsdk.PropertyId.SpeechServiceResponse_DiarizeIntermediateResults,  # noqa
                "true",
            )

        # For language identification with speech to text, define a list of candidate
        # languages that you expect in the audio. Decide whether to use at-start or
        # continuous language identification.

        # Due to above comment, we disable language identification. It is not possible
        # to identify language without candidate languages.

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

    async def connect(self) -> None:
        if self._is_connected:
            return

        warnings = self.validate_provider_capabilities("Azure")
        for warning in warnings:
            await self.host_queue.put(warning)

        try:
            # Clear errors when trying to start new connection.
            self.error = None
            speech_config = self._get_speech_config()
            audio_config = speechsdk.AudioConfig(stream=self.audio_stream)
            auto_detect_lang_cfg = self._get_autodetect_lang_cfg()

            if self.config.params.enable_speaker_diarization:
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
            else:
                self.recognizer = speechsdk.SpeechRecognizer(
                    speech_config=speech_config,
                    audio_config=audio_config,
                    auto_detect_source_language_config=auto_detect_lang_cfg,
                )
                # Same handlers: the events carry the same result shape, only
                # the signal names and the start/stop calls differ.
                self.recognizer.recognizing.connect(self._on_transcribing)
                self.recognizer.recognized.connect(self._on_transcribed)
                self.recognizer.canceled.connect(self._on_canceled)
                self.recognizer.start_continuous_recognition_async()

            self._loop = asyncio.get_running_loop()
            self._is_connected = True
            self._sender_task = asyncio.create_task(self._send_loop())

        except Exception as ex:
            self.error = ex
            raise ProviderError(f"{str(ex)}")

    async def disconnect(self) -> None:
        self._is_connected = False
        self.host_queue.put_nowait(None)
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
                stop = getattr(
                    self.recognizer,
                    "stop_transcribing_async",
                    None,
                ) or self.recognizer.stop_continuous_recognition_async
                await await_callback(stop, timeout=5)
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

    # --- Event handlers for ConversationTranscriber (STT mode) ---

    def _emit_raw_threadsafe(self, evt) -> None:
        """Hand an SDK event to the raw stream from the SDK's own thread.

        `result.json` carries the service's own response body, so it goes over
        as-is. Events without one (e.g. cancellation) only exist as the SDK's
        rendering of them, which is flagged as not verbatim.
        """
        if self._loop is None:
            return
        try:
            body = getattr(evt.result, "json", None)
        except Exception:
            body = None
        if body:
            self._loop.call_soon_threadsafe(self.emit_raw, body)
        else:
            self._loop.call_soon_threadsafe(self.emit_raw, str(evt), False)

    def _on_transcribing(self, evt):
        self._emit_raw_threadsafe(evt)
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
        self._emit_raw_threadsafe(evt)
        if self._loop:
            result: ConversationTranscriptionResult = evt.result
            text = result.text
            if not text:
                return

            confidence = None
            try:
                result_dict = json.loads(evt.result.json)
                if "NBest" in result_dict and result_dict["NBest"]:
                    best = result_dict["NBest"][0]
                    confidence = best.get("Confidence")
                    # Both forms arrive on every result; `result.text` is
                    # Display, `Lexical` is the raw words.
                    if not self.config.params.options["display_form"]:
                        text = best.get("Lexical") or text

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
                if self.config.params.enable_endpoint_detection:
                    part2 = make_part(
                        text=" <end>",
                        confidence=confidence,
                        is_final=True,
                        start_ms=start_ms,
                        end_ms=end_ms,
                        speaker=speaker,
                        language=language,
                    )
                    parts.append(part2)
                asyncio.run_coroutine_threadsafe(self._handle_result(parts), self._loop)

            except Exception as ex:
                self.error = ex
                raise ProviderError(
                    f"Error parsing ConversationTranscriber result JSON: {ex}"
                )

    def _on_canceled(self, evt):
        self._emit_raw_threadsafe(evt)
        error = evt.error_details or "Recognition canceled"
        if self._loop:
            asyncio.run_coroutine_threadsafe(self._handle_error(error), self._loop)

    async def _handle_result(self, parts):
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
        partial = FeatureStatus.partial()
        return SupportedFeatures(
            name="Azure",
            model="Universal Language Model (base)",
            single_multilingual_model=unsupported,
            language_hints=unsupported,
            # Azure language identification accepts up to 10 candidate languages.
            max_language_hints=10,
            language_identification=FeatureStatus.partial(
                comment="Azure's language detection is limited to detecting one out of a maximum of 10 inputted languages. Soniox can detect any language that is currently supported. [Click here for more info.](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/language-identification?tabs=once&pivots=programming-language-python)"
            ),  # https://learn.microsoft.com/en-us/azure/ai-services/speech-service/language-identification?tabs=once&pivots=programming-language-csharp # noqa
            speaker_diarization=partial,  # https://learn.microsoft.com/en-us/azure/ai-services/speech-service/get-started-stt-diarization?tabs=linux&pivots=programming-language-csharp # noqa
            customization=supported,  # https://learn.microsoft.com/en-us/azure/ai-services/speech-service/improve-accuracy-phrase-list?tabs=terminal&pivots=programming-language-csharp # noqa
            timestamps=supported,  # ADDED https://learn.microsoft.com/en-us/azure/ai-services/speech-service/get-speech-recognition-results?pivots=programming-language-csharp # noqa
            confidence_scores=supported,  # ADDED https://learn.microsoft.com/en-us/azure/ai-services/speech-service/get-speech-recognition-results?pivots=programming-language-csharp # noqa
            # Only Speech_SegmentationStrategy=Semantic is set (that is the
            # endpoint detection above); no silence timeout property is sent.
            real_time_latency_config=supported,  # Speech_SegmentationSilenceTimeoutMs and SpeechServiceConnection_InitialSilenceTimeoutMs, https://learn.microsoft.com/en-us/dotnet/api/microsoft.cognitiveservices.speech.propertyid?view=azure-dotnet # noqa
            # https://learn.microsoft.com/en-us/azure/ai-services/speech-service/how-to-recognize-speech?pivots=programming-language-csharp # noqa
            options={
                # Not an Azure request parameter: every result carries both
                # forms and this picks which one we render. Off by default like
                # the other formatting options, so every card starts from raw
                # words — Azure hands back formatted text where Deepgram hands
                # back raw, so "what the vendor gives unasked" is not a
                # comparable baseline.
                "display_form": ProviderOption(
                    default=False,
                    comment="Renders Azure's Display form, punctuated and cased. "
                    "Off shows Lexical: the same words with neither.",
                ),
            },
            text_formatting=FeatureStatus.supported(
                comment="The service returns both a punctuated Display form and an unformatted Lexical one; the setting picks between them.",
            ),
            endpoint_detection=supported,
            manual_finalization=unsupported,
        )
