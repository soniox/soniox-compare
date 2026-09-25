import asyncio
import json
import logging

import websockets

from providers.base import BaseProvider
from providers.config import (
    FeatureStatus,
    ProviderConfig,
    ProviderError,
    SupportedFeatures,
)
from utils import data_event, error_message, info_message, make_part, session_done_event
from languages import get_source_language, get_target_language

log = logging.getLogger("translate.speechmatics")

# Speechmatics real-time model. "enhanced" is the higher-accuracy model;
# "standard" is faster but noticeably worse on the accented speech this
# comparison is usually fed. (Docs renamed the old `operating_point` field to
# `model`; same values.)
MODEL = "enhanced"
# How long Speechmatics may buffer before committing a final. Lower means
# snappier finals at some cost to accuracy; 1s keeps pace with the other cards.
MAX_DELAY_SEC = 1.0
# Speechmatics has no auto-detect on the real-time endpoint — `language` is
# required and fixes the source side for the whole session.
DEFAULT_SOURCE_LANGUAGE = "en"


def _speaker_number(label: str | None) -> int | None:
    """Speechmatics labels speakers "S1", "S2"..., and "UU" when unknown."""
    if not label or not label.startswith("S"):
        return None
    try:
        return int(label[1:])
    except ValueError:
        return None


def _ms(seconds: float | None) -> int | None:
    return None if seconds is None else int(seconds * 1000)


class SpeechmaticsProvider(BaseProvider):
    """Transcription and translation share one socket. Speechmatics has no TTS,
    so this provider is text-only and its s2s tile stays greyed out.

    Partials are *replacements*, not deltas: each `AddPartialTranscript`
    supersedes the previous one. The frontend replaces `nonFinalParts` wholesale
    per message, so the transcript and translation partials must be re-emitted
    together every time — otherwise a translation partial would blank out the
    transcript partial that arrived a moment earlier.
    """

    name = "speechmatics"

    def __init__(self, config: ProviderConfig):
        super().__init__(config)
        self.api_key = config.service.api_key
        self._ws: websockets.ClientConnection | None = None
        self._source_language = DEFAULT_SOURCE_LANGUAGE
        # Number of audio frames sent; `EndOfStream` must echo the last one back
        # or Speechmatics will not finalize.
        self._seq_no = 0
        self._partial_original: dict | None = None
        self._partial_translation: dict | None = None

    async def connect(self) -> None:
        if self._is_connected:
            return

        for warning in self.validate_provider_capabilities("Speechmatics"):
            await self.host_queue.put(warning)

        hints = self.params.language_hints
        self._source_language = hints[0] if hints else DEFAULT_SOURCE_LANGUAGE
        if not hints:
            await self.host_queue.put(
                info_message(
                    self.name,
                    "Speechmatics cannot auto-detect the source language on its "
                    "real-time endpoint; defaulting to English. Pick an input "
                    "language to override.",
                    level="warning",
                )
            )

        target = self.params.target_language
        if target == self._source_language:
            raise ProviderError(
                f"Speechmatics cannot translate {self._source_language} into "
                "itself. Pick a different target language."
            )

        try:
            log.info(
                "connect model=%s source=%s target=%s",
                MODEL,
                self._source_language,
                target,
            )
            self._ws = await websockets.connect(
                self.service.websocket_url,
                additional_headers={"Authorization": f"Bearer {self.api_key}"},
            )
            await self._ws.send(json.dumps(self._build_config(target)))

            self._tasks = [
                asyncio.create_task(self._send_loop()),
                asyncio.create_task(self._recv_loop()),
            ]
            self._is_connected = True
        except ProviderError:
            raise
        except Exception as ex:
            raise ProviderError(f"{ex}")

    def _build_config(self, target: str) -> dict:
        transcription_config: dict = {
            # `_source_language` stays canonical for the part labels; only the
            # wire value is mapped (Speechmatics wants "cmn" for Chinese).
            "language": get_source_language(self._source_language, "speechmatics"),
            "model": MODEL,
            "enable_partials": True,
            "max_delay": MAX_DELAY_SEC,
        }
        if self.params.enable_speaker_diarization:
            transcription_config["diarization"] = "speaker"
        return {
            "message": "StartRecognition",
            "audio_format": {
                "type": "raw",
                "encoding": "pcm_s16le",
                "sample_rate": self.config.common.sample_rate,
            },
            "transcription_config": transcription_config,
            "translation_config": {
                "target_languages": [
                    get_target_language(target, "speechmatics")
                ],
                "enable_partials": True,
            },
        }

    async def _close_upstream(self) -> None:
        if self._ws is not None:
            await self._ws.close()

    async def _send_loop(self) -> None:
        try:
            while True:
                kind, payload = await self._audio_queue.get()
                if kind == "audio":
                    await self._ws.send(payload)
                    self._seq_no += 1
                elif kind == "end":
                    await self._ws.send(
                        json.dumps(
                            {"message": "EndOfStream", "last_seq_no": self._seq_no}
                        )
                    )
                    return
        except websockets.ConnectionClosedOK:
            pass
        except websockets.ConnectionClosedError as e:
            await self.host_queue.put(
                error_message(provider=self.name, message=f"Speechmatics send: {e}")
            )

    async def _emit(self, finals: list[dict]) -> None:
        """Push finals plus whichever partials are currently live.

        The partials must ride along on every message: the frontend swaps its
        whole non-final list for the one in the latest message.
        """
        parts = [*finals]
        if self._partial_original is not None:
            parts.append(self._partial_original)
        if self._partial_translation is not None:
            parts.append(self._partial_translation)
        if parts:
            await self.host_queue.put(data_event(provider=self.name, parts=parts))

    async def _recv_loop(self) -> None:
        target = self.params.target_language
        try:
            while True:
                message = json.loads(await self._ws.recv())
                kind = message.get("message")

                if kind == "RecognitionStarted":
                    log.info("recognition.started id=%s", message.get("id"))

                elif kind == "AddPartialTranscript":
                    text = (message.get("metadata") or {}).get("transcript", "")
                    self._partial_original = (
                        self._transcript_part(message, text, is_final=False)
                        if text.strip()
                        else None
                    )
                    await self._emit([])

                elif kind == "AddTranscript":
                    text = (message.get("metadata") or {}).get("transcript", "")
                    self._partial_original = None
                    finals = (
                        [self._transcript_part(message, text, is_final=True)]
                        if text.strip()
                        else []
                    )
                    await self._emit(finals)

                elif kind == "AddPartialTranslation":
                    text = self._translation_text(message)
                    self._partial_translation = (
                        self._translation_part(text, target, is_final=False)
                        if text.strip()
                        else None
                    )
                    await self._emit([])

                elif kind == "AddTranslation":
                    text = self._translation_text(message)
                    self._partial_translation = None
                    finals = (
                        [self._translation_part(text, target, is_final=True)]
                        if text.strip()
                        else []
                    )
                    await self._emit(finals)

                elif kind == "EndOfTranscript":
                    log.info("recognition.end_of_transcript")
                    await self.host_queue.put(session_done_event(provider=self.name))
                    break

                elif kind == "Warning":
                    log.warning(
                        "warning type=%s: %s",
                        message.get("type"),
                        message.get("reason"),
                    )
                    await self.host_queue.put(
                        info_message(
                            self.name,
                            message.get("reason", "Speechmatics warning"),
                            level="warning",
                        )
                    )

                elif kind == "Error":
                    log.warning(
                        "error type=%s: %s", message.get("type"), message.get("reason")
                    )
                    await self.host_queue.put(
                        error_message(
                            provider=self.name,
                            message=message.get("reason", "unknown error"),
                            code=message.get("type"),
                        )
                    )
                    break

        except websockets.ConnectionClosedOK:
            pass
        except websockets.ConnectionClosed as e:
            await self.host_queue.put(
                error_message(provider=self.name, message=f"Speechmatics recv: {e}")
            )

    def _transcript_part(self, message: dict, text: str, is_final: bool) -> dict:
        metadata = message.get("metadata") or {}
        results = message.get("results") or []
        speaker = None
        if self.params.enable_speaker_diarization and results:
            alternatives = results[0].get("alternatives") or [{}]
            speaker = _speaker_number(alternatives[0].get("speaker"))
        return make_part(
            text=text,
            speaker=speaker,
            language=self._source_language,
            source_language=self._source_language,
            translation_status="original",
            is_final=is_final,
            start_ms=_ms(metadata.get("start_time")),
            end_ms=_ms(metadata.get("end_time")),
        )

    @staticmethod
    def _translation_text(message: dict) -> str:
        return " ".join(
            result.get("content", "") for result in message.get("results") or []
        )

    def _translation_part(self, text: str, target: str, is_final: bool) -> dict:
        return make_part(
            text=text + " " if is_final else text,
            language=target,
            source_language=self._source_language,
            translation_status="translation",
            is_final=is_final,
        )

    @staticmethod
    def get_available_features() -> SupportedFeatures:
        supported = FeatureStatus.supported()
        unsupported = FeatureStatus.unsupported()
        return SupportedFeatures(
            name="Speechmatics",
            model=MODEL,
            text_translation=supported,
            speech_to_speech=FeatureStatus.unsupported(
                comment="Speechmatics has no speech synthesis, so it can "
                "translate to text but cannot speak the result.",
            ),
            source_transcript=supported,
            voice_selection=unsupported,
            single_multilingual_model=FeatureStatus.unsupported(
                comment="The real-time endpoint needs the source language up "
                "front and will not auto-detect it.",
            ),
            language_hints=supported,
            max_language_hints=1,
            language_identification=unsupported,
            speaker_diarization=supported,
            timestamps=supported,
            endpoint_detection=unsupported,
        )
