import asyncio
import json
import re
from typing import Any
from urllib.parse import urlencode

import websockets

from config import get_language_mapping
from providers.base import (
    BaseProvider,
    ProviderError,
)
from providers.config import ProviderConfig, SupportedFeatures, FeatureStatus
from utils import make_part

# Pulse accepts at most 100 keyword-boost terms per session.
MAX_KEYWORDS = 100


class SmallestProvider(BaseProvider):
    name = "smallest"

    def __init__(self, config: ProviderConfig):
        super().__init__(config)
        self.websocket: websockets.ClientConnection | None = None
        self.client_queue: asyncio.Queue[bytes | str] = asyncio.Queue(maxsize=100)
        self._sender: asyncio.Task[Any] | None = None
        self._receiver: asyncio.Task[Any] | None = None

    def get_lang_cfg(self) -> str:
        hints = self.config.params.language_hints
        if len(hints) == 0:
            # Pulse requires an explicit language: it has no universal
            # auto-detect mode, only regional aggregators (north_indic,
            # multi-asian, multi-south-indic) this provider doesn't use.
            raise ProviderError("Smallest AI (Pulse) requires a language hint.")

        lang_mapping = get_language_mapping("smallest")
        lang_hint = hints[0]
        if lang_hint not in lang_mapping:
            raise ProviderError(f"Language {lang_hint} not supported by Smallest AI (Pulse).")
        return lang_mapping[lang_hint]

    def _keywords(self) -> str:
        """Keyword-boost terms derived from the shared free-text context field.

        Pulse's `keywords` param wants a comma-separated `WORD[:INTENSIFIER]`
        list rather than prose, so the context is split on the separators a
        user would naturally type (same convention as `providers/google.py`'s
        `_custom_vocabulary`). No explicit intensifier is set, so each term
        boosts at Pulse's default of 1.0.
        """
        raw = self.config.params.context
        if not raw:
            return ""
        terms: list[str] = []
        for chunk in re.split(r"[\n,;]+", raw):
            term = chunk.strip()
            if term and term not in terms:
                terms.append(term)
        return ",".join(terms[:MAX_KEYWORDS])

    async def connect(self) -> None:
        if self._is_connected:
            return

        warnings = self.validate_provider_capabilities("Smallest AI")
        for warning in warnings:
            await self.host_queue.put(warning)

        try:
            self.error = None
            language = self.get_lang_cfg()

            url_params: dict[str, Any] = {
                "model": self.config.service.model,
                "language": language,
                "encoding": "linear16",
                "sample_rate": self.config.common.sample_rate,
                "word_timestamps": "true",
                "diarize": (
                    "true" if self.config.params.enable_speaker_diarization else "false"
                ),
                # Punctuation/capitalization and spoken->written normalization
                # ("five dollars" -> "$5"); on for parity with the other
                # providers' comparable formatting flags (e.g. Deepgram's
                # `smart_format`/`numerals`).
                "format": "true",
                "itn_normalize": "true",
            }
            keywords = self._keywords()
            if keywords:
                url_params["keywords"] = keywords
            query_string = urlencode(url_params)
            full_url = f"{self.config.service.websocket_url}?{query_string}"
            headers = {"Authorization": f"Bearer {self.config.service.api_key}"}

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
        # `close_stream` flushes any buffered audio into a final transcript
        # (is_final=true, is_last=true) and then the server closes its side.
        if self.websocket:
            self.client_queue.put_nowait(json.dumps({"type": "close_stream"}))

    async def _send_loop(self):
        while self._is_connected:
            msg = await self.client_queue.get()
            if not self.websocket:
                break
            try:
                await self.websocket.send(msg)
            except Exception as ex:
                self.error = ex
                await self._handle_error(f"Sender error: {ex}")
                break

    async def _recv_loop(self):
        try:
            async for resp in self.websocket:
                self.emit_raw(resp)
                data = json.loads(resp)
                msg_type = data.get("type")

                if msg_type == "transcription":
                    await self._handle_transcription(data)
                elif msg_type == "error":
                    await self._handle_error(data.get("message", "Unknown error"))
                    break
                # Any other message type carries no transcript text we need.
        except Exception as ex:
            self.error = ex
            await self._handle_error(f"Receiver error: {ex}")

    async def _handle_transcription(self, data: dict) -> None:
        transcript = data.get("transcript", "")
        if not transcript:
            # Pulse emits an empty final transcript when `close_stream` is
            # requested over silence; there's nothing to forward.
            return

        is_final = bool(data.get("is_final", False))
        is_last = bool(data.get("is_last", False))
        # `language` just echoes the language we requested, not a detected
        # one, so it's only surfaced when the user actually asked for
        # identification (see `language_identification` below).
        language = None
        if self.config.params.enable_language_identification:
            language = data.get("language")
        words = data.get("words") or []

        parts: list[dict[str, Any]] = []
        if words:
            # Word-level breakdown is only present on final messages. Each
            # word's own text carries the spacing needed between words; a
            # trailing space is added to match the other per-word providers
            # (e.g. Deepgram) and reproduce the same spacing as `transcript`.
            for word in words:
                raw_speaker = word.get("speaker")
                speaker = (
                    raw_speaker + 1
                    if self.config.params.enable_speaker_diarization
                    and raw_speaker is not None
                    else None
                )
                start_s = word.get("start")
                end_s = word.get("end")
                parts.append(
                    make_part(
                        text=word.get("word", "") + " ",
                        is_final=is_final,
                        speaker=speaker,
                        language=language,
                        start_ms=int(start_s * 1000) if start_s is not None else None,
                        end_ms=int(end_s * 1000) if end_s is not None else None,
                        confidence=word.get("confidence"),
                    )
                )
        else:
            parts.append(make_part(text=transcript, is_final=is_final, language=language))

        # `is_final` fires both for a natural end-of-utterance pause (session
        # stays open, is_last=false) and for the flush triggered by
        # `close_stream` (is_last=true). Only mark the former as an endpoint,
        # so the forced flush at session end doesn't add a duplicate <end>.
        if parts and self.config.params.enable_endpoint_detection and is_final and not is_last:
            parts.append(make_part(text=" <end>", is_final=True))

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
        return SupportedFeatures(
            name="Smallest AI",
            model="Pulse",
            # Pulse's multi-language modes are regional aggregators
            # (north_indic, multi-asian, multi-south-indic), not one
            # universal any-language auto-detect mode.
            single_multilingual_model=unsupported,
            language_hints=supported,
            language_identification=FeatureStatus.unsupported(
                comment="`language` on the response echoes back the single "
                "language hint we requested rather than identifying one — "
                "there is no auto-detect mode spanning all languages, only "
                "regional aggregators this provider doesn't use.",
            ),
            speaker_diarization=supported,
            customization=FeatureStatus.supported(
                comment="The context is used as `keywords` boosting terms, "
                "split on line breaks, commas and semicolons "
                f"(first {MAX_KEYWORDS} terms), each at the default intensifier."
            ),
            timestamps=supported,
            confidence_scores=supported,
            real_time_latency_config=unsupported,
            endpoint_detection=FeatureStatus.partial(
                comment="Endpoint detection is based on a fixed "
                "end-of-utterance silence timeout, not context-aware native "
                "turn detection.",
            ),
            manual_finalization=supported,
        )
