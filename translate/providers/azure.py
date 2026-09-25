import asyncio
import base64
import logging
from typing import Any

import azure.cognitiveservices.speech as speechsdk

from providers.base import BaseProvider
from providers.config import (
    FeatureStatus,
    ProviderConfig,
    ProviderError,
    SupportedFeatures,
)
from utils import audio_event, data_event, error_message, make_part, session_done_event
from languages import get_source_language, get_target_language

log = logging.getLogger("translate.azure")

MODEL = "azure-speech-translation"

# Azure's real-time translation wants a full source *locale*, not the bare
# ISO-639-1 code this app passes around; languages.py holds that mapping. With
# no source language picked at all we fall back to identifying one of these,
# and anything outside the set is transcribed as whichever member it resembles.
#
# At most 4 entries: Azure's at-start language identification
# (DetectAudioAtStart, the default mode) rejects larger candidate sets by
# closing the connection with code 1007.
_AUTODETECT_CANDIDATES = ["en-US", "es-ES", "fr-FR", "de-DE"]

# The neural voice each target language is spoken with, so s2s can synthesize.
# Translation to text works for any target in languages.py; only targets with
# a voice here can also speak. A voice from the wrong locale returns 200 with
# a fraction of a second of silence rather than an error, so these are the
# vendor's exact short names.
_TARGET_VOICE = {
    "af": "af-ZA-AdriNeural",
    "am": "am-ET-MekdesNeural",
    "ar": "ar-EG-SalmaNeural",
    "as": "as-IN-YashicaNeural",
    "az": "az-AZ-BanuNeural",
    "bg": "bg-BG-KalinaNeural",
    "bn": "bn-IN-TanishaaNeural",
    "bs": "bs-BA-VesnaNeural",
    "ca": "ca-ES-AlbaNeural",
    "cs": "cs-CZ-VlastaNeural",
    "cy": "cy-GB-NiaNeural",
    "da": "da-DK-ChristelNeural",
    "de": "de-DE-KatjaNeural",
    "el": "el-GR-AthinaNeural",
    "en": "en-US-JennyNeural",
    "es": "es-ES-ElviraNeural",
    "et": "et-EE-AnuNeural",
    "eu": "eu-ES-AinhoaNeural",
    "fa": "fa-IR-DilaraNeural",
    "fi": "fi-FI-NooraNeural",
    "fr": "fr-FR-DeniseNeural",
    "ga": "ga-IE-OrlaNeural",
    "gl": "gl-ES-SabelaNeural",
    "gu": "gu-IN-DhwaniNeural",
    "he": "he-IL-HilaNeural",
    "hi": "hi-IN-SwaraNeural",
    "hr": "hr-HR-GabrijelaNeural",
    "hu": "hu-HU-NoemiNeural",
    "hy": "hy-AM-AnahitNeural",
    "id": "id-ID-GadisNeural",
    "is": "is-IS-GudrunNeural",
    "it": "it-IT-ElsaNeural",
    "ja": "ja-JP-NanamiNeural",
    "kk": "kk-KZ-AigulNeural",
    "km": "km-KH-SreymomNeural",
    "kn": "kn-IN-SapnaNeural",
    "ko": "ko-KR-SunHiNeural",
    "lo": "lo-LA-KeomanyNeural",
    "lt": "lt-LT-OnaNeural",
    "lv": "lv-LV-EveritaNeural",
    "mk": "mk-MK-MarijaNeural",
    "ml": "ml-IN-SobhanaNeural",
    "mn": "mn-MN-YesuiNeural",
    "mr": "mr-IN-AarohiNeural",
    "ms": "ms-MY-YasminNeural",
    "mt": "mt-MT-GraceNeural",
    "my": "my-MM-NilarNeural",
    "ne": "ne-NP-HemkalaNeural",
    "nl": "nl-NL-ColetteNeural",
    "no": "nb-NO-IselinNeural",
    "pa": "pa-IN-VaaniNeural",
    "pl": "pl-PL-ZofiaNeural",
    "ps": "ps-AF-LatifaNeural",
    "pt": "pt-PT-RaquelNeural",
    "ro": "ro-RO-AlinaNeural",
    "ru": "ru-RU-SvetlanaNeural",
    "si": "si-LK-ThiliniNeural",
    "sk": "sk-SK-ViktoriaNeural",
    "sl": "sl-SI-PetraNeural",
    "so": "so-SO-UbaxNeural",
    "sq": "sq-AL-AnilaNeural",
    "sr": "sr-RS-SophieNeural",
    "sv": "sv-SE-HilleviNeural",
    "sw": "sw-TZ-RehemaNeural",
    "ta": "ta-SG-VenbaNeural",
    "te": "te-IN-ShrutiNeural",
    "th": "th-TH-AcharaNeural",
    "tl": "fil-PH-BlessicaNeural",
    "tr": "tr-TR-EmelNeural",
    "uk": "uk-UA-PolinaNeural",
    "ur": "ur-PK-UzmaNeural",
    "uz": "uz-UZ-MadinaNeural",
    "vi": "vi-VN-HoaiMyNeural",
    "yue": "yue-CN-XiaoMinNeural",
    "zh": "zh-CN-XiaoxiaoNeural",
    "zu": "zu-ZA-ThandoNeural",
}


class AzureProvider(BaseProvider):
    """Azure's Speech SDK is synchronous and callback-driven: it pushes results
    from its own native threads. We bridge those callbacks back onto the asyncio
    loop with `call_soon_threadsafe` and feed audio through a PushAudioInputStream.

    Synthesis (s2s) is event-based: with a voice set and an output format
    declared, Azure fires `synthesizing` with raw PCM for the translated text.
    Only targets in `_TARGET_VOICE` can speak; the rest are text-only.
    """

    name = "azure"

    def __init__(self, config: ProviderConfig):
        super().__init__(config)
        self._api_key = config.service.api_key
        self._region = config.service.region
        self._loop: asyncio.AbstractEventLoop | None = None
        self._push_stream: speechsdk.audio.PushAudioInputStream | None = None
        self._recognizer: speechsdk.translation.TranslationRecognizer | None = None
        self._source_language: str | None = None
        # Azure keys translations by the code we register; keep the exact casing.
        self._target_key = get_target_language(config.params.target_language, "azure")
        # True rate of the synthesized audio, parsed from the WAV header Azure
        # puts on each utterance's first chunk (see _on_synthesizing). Azure
        # delivers 16 kHz regardless of the requested output format.
        self._synth_sample_rate = 16000

    async def connect(self) -> None:
        if self._is_connected:
            return

        if not self._region:
            raise ProviderError(
                "AZURE_REGION is not set; the Azure provider needs both a key "
                "and a region."
            )

        for warning in self.validate_provider_capabilities("Azure"):
            await self.host_queue.put(warning)

        self._loop = asyncio.get_running_loop()
        hints = self.params.language_hints
        self._source_language = hints[0] if hints else None

        speaks = self.emits_audio
        voice = _TARGET_VOICE.get(self.params.target_language)
        if speaks and voice is None:
            # Reachable only via a hand-crafted request: the s2s tile is greyed
            # out for unvoiced targets. Fail loudly rather than silently muting.
            raise ProviderError(
                f"Azure has no configured voice for target "
                f"'{self.params.target_language}', so it cannot speak it."
            )

        try:
            translation_config = speechsdk.translation.SpeechTranslationConfig(
                subscription=self._api_key, region=self._region
            )
            translation_config.add_target_language(self._target_key)
            if speaks:
                # No set_speech_synthesis_output_format: translation synthesis
                # ignores it and always returns RIFF 16 kHz 16-bit mono PCM,
                # which _on_synthesizing unwraps.
                translation_config.voice_name = voice

            audio_format = speechsdk.audio.AudioStreamFormat(
                samples_per_second=self.config.common.sample_rate,
                bits_per_sample=16,
                channels=self.config.common.num_channels,
            )
            self._push_stream = speechsdk.audio.PushAudioInputStream(
                stream_format=audio_format
            )
            audio_config = speechsdk.audio.AudioConfig(stream=self._push_stream)

            # A known source locale skips the detection warm-up; otherwise let
            # Azure auto-detect across a small candidate set.
            auto_detect = None
            source_locale = (
                get_source_language(self._source_language, "azure")
                if self._source_language
                else None
            )
            if source_locale:
                translation_config.speech_recognition_language = source_locale
                recognizer = speechsdk.translation.TranslationRecognizer(
                    translation_config=translation_config, audio_config=audio_config
                )
            else:
                auto_detect = speechsdk.languageconfig.AutoDetectSourceLanguageConfig(
                    languages=_AUTODETECT_CANDIDATES
                )
                recognizer = speechsdk.translation.TranslationRecognizer(
                    translation_config=translation_config,
                    audio_config=audio_config,
                    auto_detect_source_language_config=auto_detect,
                )
            self._recognizer = recognizer

            recognizer.recognizing.connect(self._on_recognizing)
            recognizer.recognized.connect(self._on_recognized)
            recognizer.canceled.connect(self._on_canceled)
            recognizer.session_stopped.connect(self._on_session_stopped)
            if speaks:
                recognizer.synthesizing.connect(self._on_synthesizing)

            log.info(
                "connect region=%s source=%s target=%s speaks=%s",
                self._region,
                source_locale or "auto",
                self._target_key,
                speaks,
            )
            # start_continuous_recognition_async returns immediately; .get()
            # blocks until the session is established, so run it off-loop.
            await self._loop.run_in_executor(
                None, lambda: recognizer.start_continuous_recognition_async().get()
            )
            self._is_connected = True
        except ProviderError:
            raise
        except Exception as ex:
            raise ProviderError(f"{ex}")

    # The callbacks below fire on native SDK threads. Each hops back to the
    # loop thread before touching host_queue, which is a plain asyncio.Queue
    # and not safe to mutate from another thread directly.

    def _put_from_thread(self, event: dict[str, Any]) -> None:
        if self._loop is None or self._stopped:
            return
        self._loop.call_soon_threadsafe(self._safe_put, event)

    def _safe_put(self, event: dict[str, Any]) -> None:
        if self._stopped:
            return
        self.host_queue.put_nowait(event)

    def _emit_parts(self, result: Any, is_final: bool) -> None:
        parts: list[dict] = []
        suffix = " " if is_final else ""
        source_text = result.text or ""
        if source_text.strip():
            parts.append(
                make_part(
                    text=source_text + suffix,
                    language=self._source_language,
                    source_language=self._source_language,
                    translation_status="original",
                    is_final=is_final,
                )
            )
        translation = (result.translations or {}).get(self._target_key, "")
        if translation.strip():
            parts.append(
                make_part(
                    text=translation,
                    language=self.params.target_language,
                    source_language=self._source_language,
                    translation_status="translation",
                    is_final=is_final,
                )
            )
        if parts:
            self._put_from_thread(data_event(provider=self.name, parts=parts))

    def _on_recognizing(self, evt: Any) -> None:
        self._emit_parts(evt.result, is_final=False)

    def _on_recognized(self, evt: Any) -> None:
        self._emit_parts(evt.result, is_final=True)

    def _on_synthesizing(self, evt: Any) -> None:
        audio = evt.result.audio
        if not audio:
            return
        # Azure ignores set_speech_synthesis_output_format for translation
        # synthesis and always streams RIFF-headered 16 kHz 16-bit mono PCM
        # (verified empirically: requesting raw/24 kHz formats returns the
        # identical byte stream). The first chunk of an utterance carries the
        # WAV header; forwarding it as samples plays a click, and labeling the
        # stream 24 kHz plays it 1.5x fast. Parse the real rate from the
        # header and strip it.
        if audio.startswith(b"RIFF") and len(audio) >= 44:
            rate = int.from_bytes(audio[24:28], "little")
            if 8000 <= rate <= 48000:
                self._synth_sample_rate = rate
            data_pos = audio.find(b"data", 12)
            audio = audio[data_pos + 8 :] if data_pos != -1 else audio[44:]
            if not audio:
                return
        self._put_from_thread(
            audio_event(
                provider=self.name,
                pcm_b64=base64.b64encode(audio).decode("ascii"),
                sample_rate=self._synth_sample_rate,
            )
        )

    def _on_canceled(self, evt: Any) -> None:
        reason = getattr(evt, "error_details", None) or str(getattr(evt, "reason", ""))
        # EndOfStream is the normal close after our push stream ends, not a fault.
        if getattr(evt, "reason", None) == speechsdk.CancellationReason.EndOfStream:
            self._put_from_thread(session_done_event(provider=self.name))
            return
        log.warning("azure.canceled reason=%s", reason)
        self._put_from_thread(
            error_message(provider=self.name, message=reason or "canceled")
        )

    def _on_session_stopped(self, evt: Any) -> None:
        self._put_from_thread(session_done_event(provider=self.name))

    async def send(self, data: bytes) -> None:
        if self._push_stream is not None:
            self._push_stream.write(data)

    async def send_end(self) -> None:
        # Closing the push stream is Azure's end-of-audio signal; the recognizer
        # finalizes and fires session_stopped / canceled(EndOfStream).
        if self._push_stream is not None:
            self._push_stream.close()

    async def _close_upstream(self) -> None:
        if self._recognizer is not None and self._loop is not None:
            await self._loop.run_in_executor(
                None,
                lambda: self._recognizer.stop_continuous_recognition_async().get(),
            )

    @staticmethod
    def get_available_features() -> SupportedFeatures:
        supported = FeatureStatus.supported()
        unsupported = FeatureStatus.unsupported()
        return SupportedFeatures(
            name="Azure",
            model=MODEL,
            text_translation=supported,
            speech_to_speech=FeatureStatus.partial(
                comment="Azure can speak the translation, but only for the "
                "subset of target languages with a configured neural voice.",
            ),
            source_transcript=supported,
            voice_selection=unsupported,
            single_multilingual_model=supported,
            language_hints=supported,
            max_language_hints=1,
            language_identification=unsupported,
            speaker_diarization=unsupported,
            timestamps=unsupported,
            endpoint_detection=unsupported,
        )
