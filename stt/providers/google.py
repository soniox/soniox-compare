import asyncio
import logging
import re
from typing import Any

from google import genai
from google.genai import types

from config import get_language_mapping
from providers.base import BaseProvider, ProviderError
from providers.config import (
    FeatureStatus,
    ProviderConfig,
    ProviderOption,
    SupportedFeatures,
)
from utils import make_part

log = logging.getLogger("stt.google")

MODEL = "gemini-3.5-transcribe-live"

SUPPORTED_LANGUAGES_URL = (
    "https://ai.google.dev/gemini-api/docs/live-api/live-transcribe#supported-languages"
)

# VERBATIM keeps what was said; SMART rewrites it — dropping filler words and
# reformatting lists — so it is the formatted mode, exposed as an option and off
# by default like every other provider's formatting switch.
VERBATIM_MODE = types.AudioTranscriptionConfigMode.VERBATIM
SMART_MODE = types.AudioTranscriptionConfigMode.SMART

MAX_CUSTOM_VOCABULARY_TERMS = 1000


class GoogleProvider(BaseProvider):
    """Streams audio to Gemini 3.5 Transcribe Live over the Gemini Live API.

    The model reports each utterance twice: `interim_input_transcription` while
    the speaker is still talking (a speculative hypothesis that is rewritten as
    more audio arrives) and `input_transcription` once the turn is finalized.
    That maps onto the frontend's model directly, which replaces the non-final
    parts on every message and appends the final ones.
    """

    name = "google"

    def __init__(self, config: ProviderConfig):
        super().__init__(config)
        self._client = genai.Client(api_key=config.service.api_key)
        self._audio_queue: asyncio.Queue[tuple[str, bytes | None]] = asyncio.Queue()
        # Set once the live session is open and ready to accept audio.
        self._ready: asyncio.Event = asyncio.Event()
        self._run_task: asyncio.Task | None = None
        self._stopped = False
        # Set on send_end(), so the transcript flushed by the end-of-audio signal
        # doesn't get a trailing `<end>` marker after the last words.
        self._closing = False
        # Finalized utterances arrive without a leading space, so consecutive
        # ones need an explicit separator when concatenated.
        self._has_final_text = False

    def _language_codes(self) -> list[str]:
        """The BCP-47 codes the model expects for the requested hints.

        An empty list turns on automatic language identification, which also
        covers multilingual speech and code-switching.
        """
        mapping = get_language_mapping("google")
        codes: list[str] = []
        for hint in self.config.params.language_hints:
            code = mapping.get(hint)
            if code is None:
                raise ProviderError(f"Google does not support language {hint}.")
            codes.append(code)
        return codes

    def _custom_vocabulary(self) -> list[str]:
        """Biasing phrases derived from the shared free-text context field.

        `custom_vocabulary` wants discrete terms rather than prose, so the
        context is split on the separators a user would naturally type.
        """
        raw = self.config.params.context
        if not raw:
            return []
        terms: list[str] = []
        for chunk in re.split(r"[\n,;]+", raw):
            term = chunk.strip()
            if term and term not in terms:
                terms.append(term)
        return terms[:MAX_CUSTOM_VOCABULARY_TERMS]

    async def connect(self) -> None:
        if self._is_connected:
            return

        self.error = None
        for warning in self.validate_provider_capabilities("Google"):
            await self.host_queue.put(warning)

        if not self.config.service.api_key:
            raise ProviderError("GOOGLE_API_KEY is not set.")

        self._run_task = asyncio.create_task(self._run())

        # Surface a connection failure to connect() instead of hanging forever.
        ready = asyncio.create_task(self._ready.wait())
        done, _ = await asyncio.wait(
            {ready, self._run_task}, return_when=asyncio.FIRST_COMPLETED
        )
        if self._run_task in done and not self._ready.is_set():
            ready.cancel()
            exc = self._run_task.exception()
            if exc is not None:
                raise exc
            raise ProviderError("Gemini live session closed before becoming ready")

        self._is_connected = True

    async def disconnect(self) -> None:
        if self._stopped:
            return
        self._stopped = True
        self._is_connected = False
        if self._run_task is not None:
            self._run_task.cancel()
            await asyncio.gather(self._run_task, return_exceptions=True)

    async def send(self, data: bytes | str) -> None:
        if self.error is not None:
            raise self.error
        if not self._is_connected:
            raise ProviderError("Not connected.")
        if isinstance(data, bytes):
            await self._audio_queue.put(("audio", data))
        elif data == "END":
            await self.send_end()
        else:
            raise ValueError(f"GoogleProvider received unexpected data: '{data}'.")

    async def send_end(self) -> None:
        """Signal that no more audio will arrive.

        This returns immediately: the final transcript is emitted by the receive
        loop, which the client picks up during its post-END drain window.
        """
        self._closing = True
        await self._audio_queue.put(("end", None))

    async def _run(self) -> None:
        """Own the live session for its whole lifetime.

        The SDK session object is only valid inside the `async with` block, so
        the send and receive loops run nested within it.
        """
        if self.config.params.options["smart_mode"]:
            mode = SMART_MODE
        else:
            mode = VERBATIM_MODE
        transcription = types.AudioTranscriptionConfig(
            language_codes=self._language_codes(),
            mode=mode,
        )
        vocabulary = self._custom_vocabulary()
        if vocabulary:
            transcription.custom_vocabulary = vocabulary

        config = types.LiveConnectConfig(
            # Transcripts arrive on `input_audio_transcription` rather than as a
            # model turn, but the Live API still requires a response modality
            # and this model only accepts TEXT.
            response_modalities=[types.Modality.TEXT],
            input_audio_transcription=transcription,
            # No `realtime_input_config`: endpointing is left entirely to the
            # server's default automatic VAD. Overriding it (shorter
            # `silence_duration_ms`, higher end-of-speech sensitivity) does cut
            # turns more often but splits them mid-phrase and measurably
            # degrades the transcript, since the model loses the surrounding
            # context it uses to resolve words.
        )

        try:
            async with self._client.aio.live.connect(
                model=MODEL, config=config
            ) as session:
                log.info(
                    "google.session open model=%s languages=%s",
                    MODEL,
                    transcription.language_codes or "auto",
                )
                self._ready.set()
                async with asyncio.TaskGroup() as tg:
                    tg.create_task(self._send_loop(session))
                    tg.create_task(self._recv_loop(session))
        except asyncio.CancelledError:
            raise
        except BaseExceptionGroup as eg:
            await self._handle_session_failure(eg)
        except Exception as exc:
            await self._handle_session_failure(exc)
        finally:
            # Every ending (server close, failure, cancellation from
            # disconnect) passes through here, so this is the one place that
            # tells the forward loop the session is over.
            self._is_connected = False
            self.host_queue.put_nowait(None)

    async def _send_loop(self, session) -> None:
        mime_type = f"audio/pcm;rate={self.config.common.sample_rate}"
        while True:
            kind, payload = await self._audio_queue.get()
            if kind == "audio":
                if payload:
                    await session.send_realtime_input(
                        audio=types.Blob(data=payload, mime_type=mime_type)
                    )
            elif kind == "end":
                # Hybrid VAD: audio_stream_end asks the model to finalize the
                # current turn now instead of waiting out its own silence timer,
                # so the tail of the transcript lands with minimal latency.
                log.info("google.input_end -> audio_stream_end")
                await session.send_realtime_input(audio_stream_end=True)
                return
            elif kind == "stop":
                # The receive loop ended the session; nothing left to send.
                return

    async def _recv_loop(self, session) -> None:
        try:
            # `session.receive()` yields one turn's worth of messages and then
            # the iterator ends, so it is re-entered to keep listening across
            # turns.
            stream = session.receive().__aiter__()
            while not self._stopped:
                try:
                    response = await stream.__anext__()
                except StopAsyncIteration:
                    stream = session.receive().__aiter__()
                    continue

                self.emit_raw(response)

                if response.go_away is not None:
                    log.warning(
                        "google.go_away time_left=%s",
                        getattr(response.go_away, "time_left", None),
                    )

                server_content = response.server_content
                if not server_content:
                    continue

                final = server_content.input_transcription
                interim = server_content.interim_input_transcription
                parts: list[dict[str, Any]] = []

                if final and final.text:
                    parts.append(self._transcript_part(final, is_final=True))
                    self._has_final_text = True
                    # A finalized utterance IS the model's endpoint decision, so
                    # the marker goes right after it — except for the flush
                    # triggered by our own end-of-audio signal.
                    if (
                        self.config.params.enable_endpoint_detection
                        and not self._closing
                    ):
                        parts.append(make_part(text=" <end>", is_final=True))
                elif interim and interim.text:
                    # Only emitted when the same message carries no final: the
                    # final supersedes its own interim hypothesis, and keeping
                    # both would render the utterance twice.
                    parts.append(self._transcript_part(interim, is_final=False))

                if parts:
                    await self._emit(parts)
        finally:
            await self._audio_queue.put(("stop", None))

    def _transcript_part(
        self, transcription: types.Transcription, is_final: bool
    ) -> dict[str, Any]:
        text = (transcription.text or "").lstrip(" ")
        if self._has_final_text:
            text = " " + text

        language = None
        if self.config.params.enable_language_identification:
            language = transcription.language_code

        # The Live API reports no offsets for an utterance, so parts carry no
        # timing (see the `timestamps` feature status below).
        return make_part(text=text, is_final=is_final, language=language)

    async def _emit(self, parts: list[dict[str, Any]]) -> None:
        await self.host_queue.put(
            {
                "type": "data",
                "provider": self.name,
                "parts": parts,
            }
        )

    async def _handle_session_failure(self, exc: BaseException) -> None:
        errors = self._flatten_exception_messages(exc)
        message = "; ".join(errors) if errors else str(exc)

        if "language" in message.lower():
            message = (
                f"{message} [See Google's supported languages]"
                f"({SUPPORTED_LANGUAGES_URL})"
            )

        if not self._ready.is_set():
            raise ProviderError(message)

        log.warning("google.session error: %s", message)
        self.error = ProviderError(message)
        await self.host_queue.put(
            {
                "type": "error",
                "provider": self.name,
                "error_message": message,
            }
        )

    @staticmethod
    def _flatten_exception_messages(exc: BaseException) -> list[str]:
        if isinstance(exc, BaseExceptionGroup):
            messages: list[str] = []
            for sub_exc in exc.exceptions:
                messages.extend(GoogleProvider._flatten_exception_messages(sub_exc))
            return messages
        return [str(exc)]

    @staticmethod
    def get_available_features() -> SupportedFeatures:
        supported = FeatureStatus.supported()
        unsupported = FeatureStatus.unsupported()
        return SupportedFeatures(
            # https://ai.google.dev/gemini-api/docs/live-api/live-transcribe
            name="Google",
            model=MODEL,
            single_multilingual_model=supported,
            language_hints=supported,
            max_language_hints=None,
            language_identification=supported,
            speaker_diarization=FeatureStatus.unsupported(
                comment="Diarization is only available on the non-streaming "
                "`gemini-3.5-transcribe` model (up to 8 speakers). The Live API "
                "accepts the flag without complaint but never returns a speaker "
                "label, so it is not requested here."
            ),
            customization=FeatureStatus.supported(
                comment="The context is used as `custom_vocabulary` biasing "
                "phrases, split on line breaks, commas and semicolons "
                f"(first {MAX_CUSTOM_VOCABULARY_TERMS} terms)."
            ),
            timestamps=FeatureStatus.unsupported(
                comment="The Live API reports no offsets for a transcribed "
                "utterance; word-level timestamps require the non-streaming "
                "`gemini-3.5-transcribe` model."
            ),
            confidence_scores=unsupported,
            real_time_latency_config=unsupported,
            endpoint_detection=FeatureStatus.partial(
                comment="The server's default VAD ends a turn after roughly two "
                "seconds of silence, and that finalization drives the `<end>` "
                "marker. Continuous speech with shorter pauses therefore "
                "finalizes in long turns that can span several utterances and "
                "break mid-sentence, rather than once per utterance."
            ),
            manual_finalization=FeatureStatus.partial(
                comment="End of audio can be signalled explicitly to force the "
                "open turn to finalize, but there is no way to finalize while "
                "audio keeps flowing."
            ),
            options={
                "smart_mode": ProviderOption(
                    default=False,
                    comment="Switches the model from VERBATIM to SMART, which "
                    "punctuates and also rewrites the transcript: filler words "
                    "go and lists are reformatted.",
                )
            },
        )
