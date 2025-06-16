import asyncio
from typing import Any, AsyncGenerator, Dict, List, Optional, Union, MutableSequence

from google.api_core.client_options import ClientOptions
from google.cloud.speech_v2.services.speech import SpeechAsyncClient
from google.cloud.speech_v2.types import (
    cloud_speech,
    StreamingRecognizeRequest,
    StreamingRecognitionConfig,
    RecognitionConfig,
    TranslationConfig,
    SpeechRecognitionAlternative,
    WordInfo,
    ExplicitDecodingConfig,
    StreamingRecognitionResult,
)

from config import get_language_mapping, get_translation_language_mapping
from providers.base_provider import (
    ProviderError,
    BaseProvider,
)
from providers.config import ProviderConfig, SupportedFeatures, FeatureStatus
from utils import error_message, make_part

AudioEncoding = ExplicitDecodingConfig.AudioEncoding


class GoogleProvider(BaseProvider):
    """
    Integrates with Google Cloud Speech-to-Text V2 using the SpeechAsyncClient for
    streaming transcription. It bridges Google's async gRPC client with the
    application's asyncio event loop via internal queues:
    `_audio_chunk_queue` for outgoing audio and `_results_queue` for incoming
    transcriptions.
    See Google SpeechAsyncClient:
    https://cloud.google.com/python/docs/reference/speech/2.16.1/google.cloud.speech_v2.services.speech.SpeechAsyncClient
    """

    def __init__(self, config: ProviderConfig):
        super().__init__(config)
        self.speech_client: Optional[SpeechAsyncClient] = None

        self._audio_chunk_queue: Optional[asyncio.Queue[Optional[bytes]]] = None
        self._stop_sending_audio_event: Optional[asyncio.Event] = None
        self._recognizer_path: Optional[str] = None
        self._streaming_config: Optional[StreamingRecognitionConfig] = None
        self._manage_stream_task: Optional[asyncio.Task] = None
        self._language_pairs = get_translation_language_mapping("google")

        self._results_queue: asyncio.Queue[Optional[Dict[str, Any]]] = asyncio.Queue()
        self.log_connected()
        if self.config.params.mode == "stt":
            self._update_transcription_languages()
        elif self.config.params.mode == "mt":
            self._update_translation_language_pair()

    def _update_transcription_languages(self) -> None:
        lang_mapping = get_language_mapping("google")
        assert (
            self.config.params.mode == "stt"
        ), "_update_tarnscription_languages called in mt mode."

        if len(self.config.params.language_hints) == 0:
            raise ProviderError(
                "Google provider does not support auto language detect "
                "in streaming mode."
            )

        languages = list[str]()
        for lang_hint in self.config.params.language_hints:
            if lang_hint == "es":
                languages.append("ca-ES")
            elif lang_hint not in lang_mapping:
                raise ProviderError(f"Google does not support language {lang_hint}.")
            languages.append(lang_mapping[lang_hint])

        if len(languages) > 3:
            raise ProviderError("Google supports up 3 language inputs.")

        self.config.params.language_hints = languages

    def get_effective_region(self):
        configured_region = self.config.service.region
        if not configured_region or configured_region.lower() == "global":
            return "us-central1"  # Default to us-central1 for chirp_2/MT
        return configured_region

    def _get_audio_encoding(self) -> AudioEncoding:
        # Validates and sets up explicit audio decoding configuration.

        audio_encoding_str = "LINEAR16"

        if audio_encoding_str == "LINEAR16":
            encoding_enum = AudioEncoding.LINEAR16
        elif audio_encoding_str == "MULAW":
            encoding_enum = AudioEncoding.MULAW
        elif audio_encoding_str == "ALAW":
            encoding_enum = AudioEncoding.ALAW
        else:
            raise ValueError(f"Unsupported audio_encoding {audio_encoding_str}")
        return encoding_enum

    def _create_recognition_config_kwargs(self):
        # Prepare a mutable dict for recognition config details.
        sample_rate = self.config.common.sample_rate
        channels = self.config.common.num_channels

        encoding_enum = self._get_audio_encoding()

        recognition_config_kwargs = {
            "explicit_decoding_config": cloud_speech.ExplicitDecodingConfig(
                encoding=encoding_enum,
                sample_rate_hertz=sample_rate,
                audio_channel_count=channels,
            ),
            "features": cloud_speech.RecognitionFeatures(
                enable_automatic_punctuation=True,
                enable_word_time_offsets=True,
                enable_word_confidence=True,
            ),
            "model": getattr(self.config.service, "model", "chirp_2"),
        }

        if self.config.params.mode == "stt":
            recognition_config_kwargs["language_codes"] = (
                self.config.params.language_hints
            )
        elif self.config.params.mode == "mt":

            # Use the language and target from config for dynamic translation.
            # NOTE: Translation requires the 'chirp_2' model.
            recognition_config_kwargs["language_codes"] = (
                self.config.params.translation.source_languages
            )

            # This is google.cloud.speech_v2.types.TranslationConfig
            recognition_config_kwargs["translation_config"] = TranslationConfig(
                target_language=self.config.params.translation.target_language
            )

        return recognition_config_kwargs

    async def _initialize_client_and_configs(self):
        """
        Initializes the SpeechAsyncClient and prepares recognition/streaming
        configurations.
        """
        self.validate_provider_capabilities("Google")
        # For chirp_2 (which is our goal) or MT, a regional endpoint is necessary.
        effective_region = self.get_effective_region()

        api_endpoint = f"{effective_region}-speech.googleapis.com"
        client_options = ClientOptions(api_endpoint=api_endpoint)
        self.speech_client = SpeechAsyncClient(client_options=client_options)
        print(
            f"GoogleProvider: Client initialized for REGIONAL endpoint: {api_endpoint}"
        )

        if not self.config.service.project_id:
            raise ValueError("GoogleConfig.project_id is not set.")

        # The location in the recognizer path MUST match the endpoint's location.
        # Uses `_` for ad-hoc recognizer by default, as per Google V2 docs.
        # See: https://cloud.google.com/speech-to-text/v2/docs/recognizers#send_requests_without_recognizers # noqa
        recognizer_id_to_use = getattr(self.config.service, "recognizer_id", "_")
        self._recognizer_path = self.speech_client.recognizer_path(
            self.config.service.project_id, effective_region, recognizer_id_to_use
        )

        # ---- Chirp 2 Translation Supported Language Pairs ----
        # The Chirp 2 model has a specific, non-symmetrical list of supported language
        # pairs for translation.
        # This list is based on the official Google Cloud documentation.
        #
        # For translation TO English (en-US):
        # ar-EG, ar-x-gulf, ar-x-levant, ar-x-maghrebi, ca-ES, cy-GB, de-DE, es-419,
        # es-ES, es-US, et-EE, fr-CA, fr-FR, fa-IR, id-ID, it-IT, ja-JP, lv-LV, mn-MN,
        # nl-NL, pt-BR, ru-RU, sl-SI, sv-SE, ta-IN, tr-TR, cmn-Hans-CN
        #
        # For translation FROM English (en-US):
        # ar-EG, ar-x-gulf, ar-x-levant, ar-x-maghrebi, ca-ES, cy-GB, de-DE, et-EE,
        # fa-IR, id-ID, ja-JP, lv-LV, mn-MN, sl-SI, sv-SE, ta-IN, tr-TR, cmn-Hans-CN
        # ---------------------------------------------------------
        if not self._streaming_config:
            recognition_config_kwargs = self._create_recognition_config_kwargs()
            recognition_config_details = RecognitionConfig(**recognition_config_kwargs)

            # StreamingRecognitionConfig wraps the main RecognitionConfig for
            # streaming requests.
            self._streaming_config = StreamingRecognitionConfig(
                config=recognition_config_details,
                streaming_features=cloud_speech.StreamingRecognitionFeatures(
                    interim_results=True,
                ),
            )

    async def connect(self) -> None:
        """
        Establishes connection by initializing configs and starting the
        stream management task.
        """
        if self._is_connected:
            return
        try:
            self.error = None
            # Clear any stale results before connecting.
            while not self._results_queue.empty():
                self._results_queue.get_nowait()
                self._results_queue.task_done()

            await self._initialize_client_and_configs()

            self._audio_chunk_queue = asyncio.Queue()
            self._stop_sending_audio_event = asyncio.Event()

            # _manage_stream_task is the core asyncio task handling the Google
            # bidirectional stream.
            self._manage_stream_task = asyncio.create_task(self._manage_stream())

            self._is_connected = True

        except Exception as e:
            self._is_connected = False
            self.error = ProviderError(f"Google connection error: {e}")
            raise e

    async def _audio_request_generator(
        self,
    ) -> AsyncGenerator[StreamingRecognizeRequest, None]:
        """
        Async generator yielding audio chunks to Google's streaming_recognize method.
        """
        if not self._streaming_config or not self._recognizer_path:
            raise RuntimeError(
                "GoogleProvider internal error: Streaming config or recognizer "
                "path not initialized."
            )

        # First request must contain the streaming configuration.
        yield StreamingRecognizeRequest(
            recognizer=self._recognizer_path, streaming_config=self._streaming_config
        )

        # Subsequent requests contain audio data from _audio_chunk_queue
        # until stop event is set.
        assert self._stop_sending_audio_event is not None
        while not self._stop_sending_audio_event.is_set():
            try:
                assert (
                    self._audio_chunk_queue is not None
                ), "self._audio_chunk_queue is None."
                chunk = await asyncio.wait_for(
                    self._audio_chunk_queue.get(), timeout=0.1
                )
                if chunk is None:
                    # None signals end of audio stream from send_end().
                    self._stop_sending_audio_event.set()
                    break
                if isinstance(chunk, bytes) and len(chunk) > 0:
                    yield StreamingRecognizeRequest(audio=chunk)
                elif isinstance(chunk, bytes) and len(chunk) == 0:
                    pass  # Ignore empty audio byte strings.
            except asyncio.TimeoutError:
                # Timeout allows checking _stop_sending_audio_event periodically.
                if self._stop_sending_audio_event.is_set():
                    break
                continue
            except Exception as e:
                # Catch any other exception to ensure the generator stops gracefully.
                self._stop_sending_audio_event.set()
                err_msg = (
                    f"Internal error: _audio_request_generator failed with {str(e)}"
                )
                self.error = ProviderError(err_msg)
                await self._results_queue.put(error_message(err_msg, "google"))
                break

    async def _handle_error(self, response_error: Any):
        err_msg = (
            "Google API Error in response message: "
            f"{response_error.message} (code: {response_error.code})"
        )
        self.error = ProviderError(err_msg)
        await self._results_queue.put(error_message(err_msg, "google"))

    def _process_words(
        self,
        all_parts_for_message: list[dict],
        words: MutableSequence[WordInfo],
        is_utterance_start: bool,
        is_final_segment: bool,
        language_code: str,
        part_translation_status: str,
    ) -> tuple[list[dict], bool]:
        for word_info in words:
            # Ensure no leading space from Google
            current_text_segment = word_info.word.lstrip(" ")
            text_to_emit = current_text_segment

            if not all_parts_for_message:
                # First word in this particular response batch.
                if not is_utterance_start:
                    # Not the first word of the entire utterance.
                    text_to_emit = " " + current_text_segment
            else:
                # Subsequent words in this batch always get a
                # leading space.
                text_to_emit = " " + current_text_segment

            if word_info.start_offset:
                start_ms = word_info.start_offset.total_seconds() * 1000
            else:
                start_ms = None

            if word_info.end_offset:
                end_ms = word_info.end_offset.total_seconds() * 1000
            else:
                end_ms = None

            if (
                self.config.params.enable_language_identification
                or self.config.params.mode == "mt"
            ):
                language = language_code
            else:
                language = None

            part = make_part(
                text=text_to_emit,
                start_ms=start_ms,
                end_ms=end_ms,
                language=language,
                confidence=word_info.confidence,
                is_final=is_final_segment,
                translation_status=part_translation_status,
            )
            all_parts_for_message.append(part)
            if current_text_segment.strip():
                # If actual text content, next part is not
                # utterance start.
                is_utterance_start = False

        return all_parts_for_message, is_utterance_start

    def _process_transcript(
        self,
        all_parts_for_message: list[dict],
        transcript: str,
        is_utterance_start: bool,
        is_final_segment: bool,
        language_code: str,
        part_translation_status: str,
        confidence: float,
        result_end_offset,
    ) -> tuple[list[dict], bool]:
        # Fallback if no word-level detail, use full transcript.
        # Ensure no leading space from Google
        current_text_segment = transcript.lstrip(" ")
        text_to_emit = current_text_segment

        if not all_parts_for_message:
            if not is_utterance_start:
                text_to_emit = " " + current_text_segment
        else:
            text_to_emit = " " + current_text_segment

        # Calculate end_ms for transcript-level part
        if result_end_offset:
            end_ms_val = result_end_offset.total_seconds() * 1000
        else:
            end_ms_val = None

        if (
            self.config.params.enable_language_identification
            or self.config.params.mode == "mt"
        ):
            language = language_code
        else:
            language = None

        part = make_part(
            text=text_to_emit,
            confidence=confidence,
            is_final=is_final_segment,
            language=language,
            end_ms=end_ms_val,
            translation_status=part_translation_status,
        )
        all_parts_for_message.append(part)
        if current_text_segment.strip():
            is_utterance_start = False

        return all_parts_for_message, is_utterance_start

    async def _manage_stream(self):
        """
        Manages the bidirectional gRPC stream with Google Speech API for transcription.
        """
        if not self.speech_client:
            err_msg = "Google client not initialized"
            self.error = ProviderError(err_msg)
            await self._results_queue.put(error_message(err_msg, "google"))
            return

        # Used for prepending spaces correctly between transcript parts.
        is_utterance_start = True
        responses_iterator = None
        try:
            # speech_client.streaming_recognize establishes the bidi stream.
            # It takes an async iterable for requests and returns an async iterable for
            # responses.
            responses_iterator = await self.speech_client.streaming_recognize(
                requests=self._audio_request_generator()
            )

            # Each `response` is a `StreamingRecognizeResponse` object.
            # See: https://cloud.google.com/python/docs/reference/speech/2.16.1/google.cloud.speech_v2.types.StreamingRecognizeResponse # noqa
            async for response in responses_iterator:
                response_error = getattr(response, "error", None)
                if response_error:
                    await self._handle_error(response_error)
                    break

                SpeechEventType = (
                    cloud_speech.StreamingRecognizeResponse.SpeechEventType
                )
                if (
                    response.speech_event_type
                    != SpeechEventType.SPEECH_EVENT_TYPE_UNSPECIFIED
                ):
                    # Skip speech event messages for now.
                    continue

                # Process transcript results and manage spacing.
                all_parts_for_message = []

                translation_cfg = self.config.params.translation
                results: MutableSequence[StreamingRecognitionResult] = response.results

                for result in results:
                    if not result.alternatives:
                        continue

                    part_translation_status = None
                    if self.config.params.mode == "mt":
                        if result.language_code == translation_cfg.target_language:
                            part_translation_status = "translation"
                        elif result.language_code in translation_cfg.source_languages:
                            # Source language
                            part_translation_status = "original"
                        # If language_code is neither, it remains None (or handle as an
                        # unexpected case if needed)

                    alternative: SpeechRecognitionAlternative = result.alternatives[0]
                    is_final_segment = result.is_final
                    language_code = result.language_code

                    if alternative.words:
                        all_parts_for_message, is_utterance_start = self._process_words(
                            all_parts_for_message=all_parts_for_message,
                            words=alternative.words,
                            is_utterance_start=is_utterance_start,
                            is_final_segment=is_final_segment,
                            language_code=language_code,
                            part_translation_status=part_translation_status,
                        )

                    elif alternative.transcript:
                        all_parts_for_message, is_utterance_start = (
                            self._process_transcript(
                                all_parts_for_message=all_parts_for_message,
                                transcript=alternative.transcript,
                                is_utterance_start=is_utterance_start,
                                is_final_segment=is_final_segment,
                                language_code=language_code,
                                part_translation_status=part_translation_status,
                                confidence=alternative.confidence,
                                result_end_offset=result.result_end_offset,
                            )
                        )

                if all_parts_for_message:
                    # Put successfully processed transcript parts onto
                    # the internal results queue.
                    formatted_output = self.format_output(all_parts_for_message)
                    await self._results_queue.put(formatted_output)

        except asyncio.CancelledError as e:
            # Expected on disconnect.
            self.error = e
            pass
        except Exception as e:
            err_msg = f"Google streaming error: {str(e)}"
            self.error = ProviderError(err_msg)
            await self._results_queue.put(error_message("google", err_msg))
        finally:
            # Critical cleanup: ensure connection status is updated and queues
            # are handled.
            self._is_connected = False
            if self._stop_sending_audio_event:
                # Ensure audio generator stops.
                self._stop_sending_audio_event.set()
            # Unblock audio generator if it's waiting on an empty queue after
            # stop_event is set.
            if self._audio_chunk_queue and self._audio_chunk_queue.empty():
                await self._audio_chunk_queue.put(None)
            # Signal end of results to any consumer of receive().
            await self._results_queue.put(None)

    async def send(self, data: Union[bytes, str]) -> None:
        """
        Sends audio data (bytes) or an END signal (str) to the Google stream via
        an internal queue.
        """

        if (
            not self._is_connected
            or not self._audio_chunk_queue
            or (
                self._stop_sending_audio_event
                and self._stop_sending_audio_event.is_set()
            )
        ):
            reason = "unknown"
            if self.error is not None:
                reason = str(self.error)
            elif not self._is_connected:
                reason = "not connected"
            elif not self._audio_chunk_queue:
                # Should not happen if connected.
                reason = "audio queue not ready"
            elif (
                self._stop_sending_audio_event
                and self._stop_sending_audio_event.is_set()
            ):
                reason = "stopping/stopped"
            raise ProviderError(f"GoogleProvider send failed: provider is {reason}")

        if isinstance(data, bytes):
            await self._audio_chunk_queue.put(data)
        elif isinstance(data, str):
            if data == "END":  # Handle application-level END signal.
                await self.send_end()
            else:
                raise ValueError(
                    f"GoogleProvider received unexpected string data: '{data}'. "
                    "Expected bytes or 'END'."
                )
        else:
            raise TypeError(
                f"GoogleProvider received unexpected data type: {type(data)}. "
                "Expected bytes or str."
            )

    async def send_end(self) -> None:
        """
        Signals the end of audio transmission and waits for the stream manager to
        process remaining data.
        """
        if self._stop_sending_audio_event:
            self._stop_sending_audio_event.set()  # Signal audio generator to stop.

        if self._audio_chunk_queue:
            await self._audio_chunk_queue.put(
                None
            )  # Send sentinel to unblock generator if waiting.

        # Wait for the _manage_stream_task to finish processing responses from Google.
        if self._manage_stream_task and not self._manage_stream_task.done():
            try:
                await asyncio.wait_for(self._manage_stream_task, timeout=10.0)
            except asyncio.TimeoutError:
                # If timeout, attempt to cancel the task.
                self._manage_stream_task.cancel()
                try:
                    await self._manage_stream_task  # Allow cancellation to propagate.
                except asyncio.CancelledError:
                    pass  # Expected if cancellation was successful.
                except (
                    Exception
                ):  # Catch any error during the task awaiting after cancellation.
                    pass
            except Exception:  # Catch any other error during initial await_for.
                pass

    async def disconnect(self) -> None:
        """
        Orchestrates a graceful shutdown of the provider, including ending the
        stream and cleaning resources.
        """
        await self.send_end()  # Ensure audio stream is properly ended first.

        if self._manage_stream_task and not self._manage_stream_task.done():
            self._manage_stream_task.cancel()
            try:
                # Wait for the task to acknowledge cancellation.
                await self._manage_stream_task
            except asyncio.CancelledError:
                pass  # Expected.
            except Exception:  # Catch any error during task cleanup.
                pass

        if (
            self.speech_client
        ):  # SpeechAsyncClient doesn't have an explicit close method in docs.
            self.speech_client = None  # Allow garbage collection.

        self._is_connected = False
        # Clear and signal end on results queue.
        if self._results_queue:
            while not self._results_queue.empty():
                try:
                    self._results_queue.get_nowait()
                    self._results_queue.task_done()
                except asyncio.QueueEmpty:
                    break
            await self._results_queue.put(None)

    async def receive(self) -> List[Dict[str, Any]]:
        """Retrieves processed transcription results from an internal queue."""
        if not self._results_queue:
            # This should ideally not happen if provider is used correctly
            # (after connect()).
            err_msg = (
                "Google provider results queue not available "
                "(provider not initialized properly)."
            )
            self.error = ProviderError(err_msg)
            return [error_message(err_msg, "google")]

        items = []
        while not self._results_queue.empty():
            items.append(await self._results_queue.get())
        return items

    def format_output(self, parts_list):
        return {
            "type": "data",
            "provider": self.config.service.provider_name,
            "parts": parts_list,
        }

    def _update_translation_language_pair(self) -> None:
        assert (
            self.config.params.translation is not None
        ), "Translation params must not be non."

        source_langs = self.config.params.translation.source_languages
        target_lang = self.config.params.translation.target_language

        if not source_langs:
            raise ProviderError("No source language codes provided.")
        if not target_lang:
            raise ProviderError("No target language codes provided.")

        # Holds available source languages: {"en": "en-US", "fr": "fr-FR"}
        available_source_langs = {
            code.split("-")[0]: code for code in self._language_pairs.keys()
        }

        google_source_langs = list[str]()
        google_target_lang = ""
        for i, source_lang in enumerate(source_langs):
            if source_lang not in available_source_langs:
                raise ProviderError(f"Source language: {source_lang} not supported.")
            source_full_code = available_source_langs[source_lang]

            available_target_langs = self._language_pairs[source_full_code]
            assert isinstance(available_target_langs, list), (
                "For each source language, there should be a list "
                "of target languages in google translation mapping, "
                f"got {type(available_target_langs)}"
            )
            available_target_map = {
                code.split("-")[0]: code for code in available_target_langs
            }

            resolved_target = (
                "ca-ES"
                if target_lang == "es"
                else available_target_map.get(target_lang)
            )
            if not resolved_target:
                raise ProviderError(
                    f"Unsupported language pair: "
                    f"{self.config.params.translation.source_languages[0]} -> "
                    f"{self.config.params.translation.target_language}."
                    "\n[Click here to see available languages.]"
                    "(https://cloud.google.com/speech-to-text/v2/docs/chirp_2-model)"
                )
            if i == 0:
                google_target_lang = resolved_target

            google_source_langs.append(source_full_code)

        self.config.params.translation.source_languages = google_source_langs
        self.config.params.translation.target_language = google_target_lang

    @staticmethod
    def get_available_features():
        supported = FeatureStatus.supported()
        unsupported = FeatureStatus.unsupported()
        return SupportedFeatures(
            # https://cloud.google.com/speech-to-text/v2/docs/chirp_2-model
            name="Google",
            model="chirp_2",
            speaker_diarization=unsupported,
            language_detection=unsupported,
            endpoint_detection=FeatureStatus.partial(),
            context=supported,
            timestamps=supported,
            translation_one_way=supported,
            translation_two_way=unsupported,
            confidence_scores=supported,
            real_time_latency_config=unsupported,
            manual_finalization=unsupported,
            customization=unsupported,
            language_identification=unsupported,
            language_hints=unsupported,
            single_multilingual_model=supported,
        )
