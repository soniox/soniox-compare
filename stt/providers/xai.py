import asyncio
import json
from typing import Any
from urllib.parse import urlencode

import websockets

from config import get_language_mapping
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


class XaiProvider(BaseProvider):
    name = "xai"

    def __init__(self, config: ProviderConfig):
        super().__init__(config)
        self.websocket: websockets.ClientConnection | None = None
        self.client_queue: asyncio.Queue[bytes | str] = asyncio.Queue(maxsize=100)
        self._sender: asyncio.Task[Any] | None = None
        self._receiver: asyncio.Task[Any] | None = None

    def get_lang_cfg(self) -> str | None:
        hints = self.config.params.language_hints
        if not hints:
            return None
        lang_mapping = get_language_mapping("xai")
        lang_hint = hints[0]
        if lang_hint not in lang_mapping:
            raise ProviderError(f"Language {lang_hint} not supported by xAI.")
        return lang_mapping[lang_hint]

    async def connect(self) -> None:
        if self._is_connected:
            return

        warnings = self.validate_provider_capabilities("xAI")
        for warning in warnings:
            await self.host_queue.put(warning)

        try:
            url_params = [
                ("model", self.config.service.model),
                ("sample_rate", self.config.common.sample_rate),
                ("encoding", "pcm"),
                ("interim_results", "true"),
                (
                    "diarize",
                    "true"
                    if self.config.params.enable_speaker_diarization
                    else "false",
                ),
                # Off at xAI, which strips "uh"/"um" from the text and the word
                # list. Kept verbatim here, as google.py pins VERBATIM mode.
                (
                    "filler_words",
                    "true" if self.config.params.options["filler_words"] else "false",
                ),
            ]
            # `language` only switches on inverse text normalization; the model
            # transcribes every supported language regardless of it.
            language = self.get_lang_cfg()
            if language:
                url_params.append(("language", language))

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
        if not self._is_connected:
            raise ProviderError("Not connected.")
        try:
            self.client_queue.put_nowait(data)
        except asyncio.QueueFull:
            await self.disconnect()
            raise ProviderError("Queue full: disconnecting.")

    async def send_end(self) -> None:
        # Flushes the remaining transcript as `transcript.done`.
        if self.websocket:
            self.client_queue.put_nowait(json.dumps({"type": "audio.done"}))

    async def _send_loop(self):
        while self._is_connected:
            msg = await self.client_queue.get()
            if not self.websocket:
                break
            try:
                await self.websocket.send(msg)
            except Exception as ex:
                await self._handle_error(f"Sender error: {ex}")
                break

    async def _recv_loop(self):
        chunk_emitted = False
        done = False
        try:
            async for resp in self.websocket:
                self.emit_raw(resp)
                data = json.loads(resp)
                msg_type = data.get("type")

                if msg_type == "transcript.partial":
                    chunk_emitted, parts = self._handle_transcript(data, chunk_emitted)
                    if parts:
                        await self._emit_parts(parts)
                elif msg_type == "transcript.done":
                    # Carries no text; every chunk was already sent as a partial.
                    done = True
                    break
                elif msg_type == "error":
                    await self._handle_error(data.get("message", "Unknown error"))
                    break
        except Exception as ex:
            # xAI drops the connection after `transcript.done` with no close
            # frame (1006), so that is a normal finish, not an error.
            if done:
                return
            await self._handle_error(f"Receiver error: {ex}")

    def _handle_transcript(self, data: dict, chunk_emitted):
        # Each chunk final is emitted as it arrives, so the `speech_final`
        # message is only the endpoint: its text restates the chunks, and can
        # leave later ones out, so it is not a safe replacement for them. It
        # carries the text itself only when no chunk final preceded it.
        text = (data.get("text") or "").strip()
        parts = []

        if not data.get("is_final"):
            if text:
                parts.append(
                    make_part(
                        text=text,
                        is_final=False,
                        language=self._detected_language(data),
                    )
                )
            return chunk_emitted, parts

        if not data.get("speech_final"):
            if text:
                parts.extend(self._final_parts(data, text))
                chunk_emitted = True
            return chunk_emitted, parts

        if text and not chunk_emitted:
            parts.extend(self._final_parts(data, text))
        if self.config.params.enable_endpoint_detection:
            parts.append(make_part(text=" <end>", is_final=True))
        return False, parts

    async def _emit_parts(self, parts: list[dict[str, Any]]) -> None:
        await self.host_queue.put(
            {"type": "data", "provider": self.name, "parts": parts}
        )

    def _detected_language(self, data: dict) -> str | None:
        if not self.config.params.enable_language_identification:
            return None
        return data.get("language")

    def _final_parts(self, data: dict, text: str) -> list[dict[str, Any]]:
        language = self._detected_language(data)
        words = data.get("words") or []
        # Split into words only when they reconstruct the transcript; otherwise
        # they can describe a different span and drop text.
        joined = " ".join((w.get("text") or "") for w in words).split()
        parts = []
        if words and joined == text.split():
            for word in words:
                raw_speaker = word.get("speaker")
                if (
                    self.config.params.enable_speaker_diarization
                    and raw_speaker is not None
                ):
                    speaker = raw_speaker + 1
                else:
                    speaker = None
                start_s = word.get("start")
                end_s = word.get("end")
                parts.append(
                    make_part(
                        text=word.get("text", "") + " ",
                        is_final=True,
                        speaker=speaker,
                        language=language,
                        start_ms=int(start_s * 1000) if start_s is not None else None,
                        end_ms=int(end_s * 1000) if end_s is not None else None,
                    )
                )
        else:
            parts.append(make_part(text=text + " ", is_final=True, language=language))

        return parts

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
            name="xAI",
            model="grok-voice-transcribe-2.0",
            single_multilingual_model=supported,
            language_hints=FeatureStatus.partial(
                comment="`language` only enables inverse text normalization "
                "(spoken numbers and currency written out); the model "
                "transcribes every supported language regardless of it, so it "
                "does not steer recognition the way a hint does elsewhere.",
            ),
            language_identification=FeatureStatus.supported(
                comment="Reported once per utterance rather than per word, so "
                "a code-switched utterance carries a single label.",
            ),
            speaker_diarization=supported,
            customization=supported,
            timestamps=supported,
            confidence_scores=unsupported,
            real_time_latency_config=unsupported,
            endpoint_detection=FeatureStatus.partial(
                comment="Finalization follows xAI's default silence-based "
                "endpointing rather than context-aware turn detection. This "
                "app sends neither `endpointing` nor `smart_turn`, the "
                "end-of-turn threshold that would make it context-aware.",
            ),
            manual_finalization=supported,
            options={
                "filler_words": ProviderOption(
                    default=False,
                    comment="On keeps \"uh\" and \"um\" in the transcript and the "
                    "word list; off lets xAI strip them, which is its default.",
                )
            },
            text_formatting=FeatureStatus.partial(
                comment="Punctuation and casing are always on, but numbers stay "
                "spelled out; there is no switch for either.",
            ),
        )
