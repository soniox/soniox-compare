import asyncio
import traceback
import math
import base64
import json
from typing import Any

import websockets

from providers.audio import StreamResampler
from providers.base import (
    BaseProvider,
    ProviderError,
)
from providers.config import ProviderConfig, SupportedFeatures, FeatureStatus
from utils import make_part

# OpenAI's GA Realtime API only accepts 24 kHz for the "audio/pcm" input format,
# so incoming audio is resampled to this rate before being sent.
OPENAI_SAMPLE_RATE = 24000

# These models reject `turn_detection` outright ("Turn detection is not
# supported for this transcription model"), so the session must omit it. They
# still stream deltas; the transcript is finalized by the commit on send_end.
NO_TURN_DETECTION_MODELS = frozenset({"gpt-realtime-whisper", "gpt-live-transcribe"})


class OpenaiProvider(BaseProvider):
    name = "openai"

    def __init__(self, config: ProviderConfig):
        super().__init__(config)
        self.config = config
        self.websocket: websockets.ClientConnection | None = None
        self.client_queue: asyncio.Queue[bytes | str] = asyncio.Queue(maxsize=100)
        self._sender: asyncio.Task[Any] | None = None
        self._receiver: asyncio.Task[Any] | None = None

        self.silence_duration_ms: int = 100
        self.end_event = asyncio.Event()

        self._resampler = StreamResampler(
            in_rate=self.config.common.sample_rate, out_rate=OPENAI_SAMPLE_RATE
        )

    async def connect(self) -> None:
        if self._is_connected:
            return

        warnings = self.validate_provider_capabilities("OpenAI")
        for warning in warnings:
            await self.host_queue.put(warning)

        try:
            self.end_event.clear()
            self._resampler.reset()
            # language_hints is already capped to OpenAI's single-hint limit by
            # validate_provider_capabilities (it falls back to auto-detection when
            # more than one language is requested).
            language = None
            if self.config.params.language_hints:
                language = self.config.params.language_hints[0]

            # The Realtime API is GA. As a trusted server-side client we connect
            # directly with the standard API key (ephemeral client secrets via
            # /v1/realtime/client_secrets are only needed for browser clients) to the
            # dedicated transcription intent and then configure the session.
            # https://developers.openai.com/api/reference/resources/realtime/subresources/client_secrets/

            session_settings = self._build_transcription_settings(language)

            connection_headers = {
                "Authorization": f"Bearer {self.config.service.api_key}",
            }

            self.websocket = await websockets.connect(
                f"{self.config.service.websocket_url}?intent=transcription",
                additional_headers=connection_headers,
            )

            await self.websocket.send(
                json.dumps(
                    {
                        "type": "session.update",
                        "session": session_settings,
                    }
                )
            )

            self._is_connected = True
            # Start bg tasks
            self._sender = asyncio.create_task(self._send_loop())
            self._receiver = asyncio.create_task(self._recv_loop())
        except Exception as ex:
            self.error = ProviderError(f"{ex}")
            raise self.error

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
            self.error = ProviderError("Queue full: disconnecting.")
            raise self.error

    async def send_end(self) -> None:
        commit_event = {"type": "input_audio_buffer.commit"}
        if self.websocket:
            await self.websocket.send(json.dumps(commit_event))
            self.end_event.set()


    async def _send_loop(self):
        while self._is_connected:
            msg = await self.client_queue.get()
            try:
                if self.websocket:
                    pcm = self._resampler.process(msg) if isinstance(msg, bytes) else msg
                    audio_chunk = base64.b64encode(pcm).decode("utf-8")
                    audio_event = {
                        "type": "input_audio_buffer.append",
                        "audio": audio_chunk,
                    }
                    await self.websocket.send(json.dumps(audio_event))
            except Exception as ex:
                self.error = ex
                await self._handle_error(ex)
                break

    async def _recv_loop(self):
        try:
            non_final_parts = []

            async for resp in self.websocket:
                self.emit_raw(resp)
                event = json.loads(resp)

                event_type = event.get("type")
                if event_type == "conversation.item.input_audio_transcription.delta":
                    logprobs = event.get("logprobs", None)

                    if not logprobs:
                        # Models outside the gpt-4o family return no logprobs,
                        # only the text. Without this they emit nothing at all.
                        delta = event.get("delta", "")
                        if delta:
                            non_final_parts.append(
                                make_part(text=delta, is_final=False)
                            )
                            await self.host_queue.put(
                                {
                                    "type": "data",
                                    "provider": self.name,
                                    "parts": non_final_parts,
                                }
                            )
                    elif logprobs:
                        for token in logprobs:
                            non_final_parts.append(
                                make_part(
                                    text=token["token"],
                                    is_final=False,
                                    speaker=None,
                                    language=None,
                                    start_ms=None,
                                    end_ms=None,
                                    confidence=math.exp(token["logprob"]),
                                )
                            )

                        if len(non_final_parts) > 0:
                            non_final_parts[-1]["text"] += " "

                        await self.host_queue.put(
                            {
                                "type": "data",
                                "provider": self.name,
                                "parts": non_final_parts,
                            }
                        )
                elif (
                    event_type
                    == "conversation.item.input_audio_transcription.completed"
                ):
                    if non_final_parts:
                        non_final_parts = []

                        logprobs = event.get("logprobs", None)

                        if not logprobs:
                            transcript = event.get("transcript", "")
                            if transcript:
                                await self.host_queue.put(
                                    {
                                        "type": "data",
                                        "provider": self.name,
                                        "parts": [
                                            make_part(
                                                text=transcript + " ", is_final=True
                                            )
                                        ],
                                    }
                                )
                        elif logprobs:
                            parts = []

                            for token in logprobs:
                                parts.append(
                                    make_part(
                                        text=token["token"],
                                        is_final=True,
                                        speaker=None,
                                        language=None,
                                        start_ms=None,
                                        end_ms=None,
                                        confidence=math.exp(token["logprob"]),
                                    )
                                )

                            if len(parts) > 0:
                                parts[-1]["text"] += " "

                            await self.host_queue.put(
                                {
                                    "type": "data",
                                    "provider": self.name,
                                    "parts": parts,
                                }
                            )
                    if self.end_event.is_set():
                        break
                elif event_type == "error" or (
                    event_type is not None and event_type.endswith(".failed")
                ):
                    error = event.get("error") or {}
                    message = error.get("message") or "OpenAI transcription failed."
                    # Empty buffer on commit just means there was nothing left to finalize; ignore it.
                    if error.get("code") == "input_audio_buffer_commit_empty":
                        continue
                    raise ProviderError(message)
        except Exception as ex:
            self.error = ex
            await self._handle_error(ex)

    async def _handle_error(self, ex):
        traceback.print_exc()

        await self.host_queue.put(
            {
                "type": "error",
                "provider": self.name,
                "error_message": str(ex),
            }
        )
        await self.disconnect()

    def _build_transcription_settings(self, language: str | None) -> dict:
        """Builds the GA transcription session object sent in the session.update event."""
        transcription: dict[str, Any] = {
            "model": self.config.service.model,
        }
        if self.config.service.prompt:
            transcription["prompt"] = self.config.service.prompt
        if language:
            transcription["language"] = language

        if self.config.service.model in NO_TURN_DETECTION_MODELS:
            turn_detection: dict[str, Any] = {}
        else:
            turn_detection = {
                "turn_detection": {
                    "type": "server_vad",
                    "silence_duration_ms": self.silence_duration_ms,
                }
            }

        return {
            "type": "transcription",
            "audio": {
                "input": {
                    "format": {"type": "audio/pcm", "rate": OPENAI_SAMPLE_RATE},
                    "transcription": transcription,
                    **turn_detection,
                }
            },
            "include": [
                "item.input_audio_transcription.logprobs",
            ],
        }

    @staticmethod
    def get_available_features():
        supported = FeatureStatus.supported()
        unsupported = FeatureStatus.unsupported()
        return SupportedFeatures(
            name="OpenAI",
            model="gpt-4o-transcribe",
            single_multilingual_model=supported,
            language_hints=unsupported,
            language_identification=unsupported,
            speaker_diarization=unsupported,
            customization=supported,
            timestamps=unsupported,
            confidence_scores=supported,
            real_time_latency_config=unsupported,
            endpoint_detection=FeatureStatus.partial(
                comment="Segments are cut by the server VAD after a fixed 100 ms "
                "of silence, not by context-aware turn detection. Each segment "
                "arrives as its own final transcript; no <end> marker is shown.",
            ),
            manual_finalization=FeatureStatus.supported(
                comment="An `input_audio_buffer.commit` finalizes whatever audio "
                "is still buffered.",
            ),
        )


class OpenaiWhisperProvider(OpenaiProvider):
    """The Whisper-family realtime model. It rejects server VAD, so the
    transcript is finalized by the commit on send_end rather than at detected
    speech boundaries, and it normalizes numbers less than gpt-4o-transcribe."""

    name = "openai:whisper"

    @staticmethod
    def get_available_features():
        features = OpenaiProvider.get_available_features()
        features.model = "gpt-realtime-whisper"
        features.endpoint_detection = FeatureStatus.unsupported(
            comment="This model rejects server VAD, so there are no detected "
            "speech boundaries; the transcript finalizes on the commit sent at "
            "the end of the stream.",
        )
        return features
