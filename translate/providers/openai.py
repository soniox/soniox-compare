import asyncio
import base64
import json
import logging
import os

import websockets

from providers.audio import StreamResampler
from providers.base import BaseProvider
from providers.config import (
    FeatureStatus,
    ProviderConfig,
    ProviderError,
    SupportedFeatures,
)
from utils import audio_event, data_event, error_message, make_part, session_done_event

log = logging.getLogger("translate.openai")

MODEL = "gpt-realtime-translate"
# OpenAI's realtime "audio/pcm" format is pinned to 24 kHz, while the browser
# captures a single 16 kHz stream shared by every provider. Resample on ingest.
SAMPLE_RATE = 24000


class OpenaiProvider(BaseProvider):
    """One socket handles translation and TTS. Text mode simply drops the
    audio deltas — there is no way to ask the model not to produce them."""

    name = "openai"

    def __init__(self, config: ProviderConfig):
        super().__init__(config)
        self.api_key = config.service.api_key
        self._ws: websockets.ClientConnection | None = None
        self._resampler = StreamResampler(
            in_rate=config.common.sample_rate, out_rate=SAMPLE_RATE
        )

    async def connect(self) -> None:
        if self._is_connected:
            return

        for warning in self.validate_provider_capabilities("OpenAI"):
            await self.host_queue.put(warning)

        try:
            url = f"{self.service.websocket_url}?model={MODEL}"
            headers = {"Authorization": f"Bearer {self.api_key}"}
            log.info("connect model=%s target=%s", MODEL, self.params.target_language)
            self._ws = await websockets.connect(url, additional_headers=headers)
            await self._ws.send(
                json.dumps(
                    {
                        "type": "session.update",
                        "session": {
                            "audio": {
                                "output": {"language": self.params.target_language}
                            }
                        },
                    }
                )
            )

            self._resampler.reset()
            self._tasks = [
                asyncio.create_task(self._send_loop()),
                asyncio.create_task(self._recv_loop()),
            ]
            self._is_connected = True
        except ProviderError:
            raise
        except Exception as ex:
            raise ProviderError(f"{ex}")

    async def _close_upstream(self) -> None:
        if self._ws is not None:
            await self._ws.close()

    async def _send_loop(self) -> None:
        try:
            while True:
                kind, payload = await self._audio_queue.get()
                if kind == "audio":
                    pcm = self._resampler.process(payload)
                    if not pcm:
                        continue
                    await self._ws.send(
                        json.dumps(
                            {
                                "type": "session.input_audio_buffer.append",
                                "audio": base64.b64encode(pcm).decode("ascii"),
                            }
                        )
                    )
                elif kind == "end":
                    await self._ws.send(json.dumps({"type": "session.close"}))
                    return
        except websockets.ConnectionClosedOK:
            pass
        except websockets.ConnectionClosedError as e:
            await self.host_queue.put(
                error_message(provider=self.name, message=f"OpenAI send: {e}")
            )

    async def _recv_loop(self) -> None:
        source_language = self.params.language_hints[0] if self.params.language_hints else None
        speaks = self.emits_audio
        unhandled_types: set[str] = set()
        try:
            while True:
                event = json.loads(await self._ws.recv())
                evt_type = event.get("type", "")
                parts = []
                if evt_type == "session.output_transcript.delta":
                    text = event.get("delta", "")
                    if text:
                        parts.append(
                            make_part(
                                text=text,
                                is_final=True,
                                translation_status="translation",
                                language=self.params.target_language,
                                source_language=source_language,
                            )
                        )
                elif evt_type == "session.output_audio.delta":
                    # The model always synthesizes; in text mode we just don't
                    # forward it.
                    if speaks:
                        await self.host_queue.put(
                            audio_event(
                                provider=self.name,
                                pcm_b64=event.get("delta", ""),
                                sample_rate=SAMPLE_RATE,
                            )
                        )
                elif evt_type == "session.closed":
                    await self.host_queue.put(session_done_event(provider=self.name))
                    break
                elif evt_type == "error":
                    err = event.get("error") or {}
                    if not isinstance(err, dict):
                        err = {"message": str(err)}
                    await self.host_queue.put(
                        error_message(
                            provider=self.name,
                            message=err.get("message", "unknown error"),
                            code=err.get("code"),
                        )
                    )
                elif evt_type not in ("session.created", "session.updated"):
                    # Log undocumented event types once each, so API-side
                    # oddities can be diagnosed from server logs without
                    # drowning them.
                    if evt_type not in unhandled_types:
                        unhandled_types.add(evt_type)
                        log.info(
                            "unhandled event type=%s payload=%.300s",
                            evt_type,
                            json.dumps(event),
                        )
                if parts:
                    await self.host_queue.put(
                        data_event(provider=self.name, parts=parts)
                    )
        except websockets.ConnectionClosedOK:
            pass
        except websockets.ConnectionClosed as e:
            await self.host_queue.put(
                error_message(provider=self.name, message=f"OpenAI recv: {e}")
            )

    @staticmethod
    def get_available_features() -> SupportedFeatures:
        supported = FeatureStatus.supported()
        unsupported = FeatureStatus.unsupported()
        return SupportedFeatures(
            name="OpenAI",
            model=MODEL,
            text_translation=supported,
            speech_to_speech=supported,
            source_transcript=FeatureStatus.unsupported(
                comment="The dedicated translation endpoint does not emit a "
                "reliable source-language transcript, so only the translated "
                "text is shown.",
            ),
            voice_selection=FeatureStatus.unsupported(
                comment="gpt-realtime-translate speaks with a fixed server "
                "voice and exposes no voice selection.",
            ),
            single_multilingual_model=supported,
            language_hints=unsupported,
            language_identification=unsupported,
            speaker_diarization=unsupported,
            timestamps=unsupported,
            endpoint_detection=unsupported,
        )
