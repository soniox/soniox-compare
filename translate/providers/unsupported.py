"""Providers that appear in the comparison UI but cannot translate.

The comparison ships more providers than can actually run. The ones here have
no real-time translation in their upstream streaming API at all, so they can
never take part. Rather than silently omitting them — which reads as an
oversight — they are declared with `text_translation: UNSUPPORTED` and rendered
greyed out, with the reason on hover.

Every name in the frontend's ALL_PROVIDERS_LIST must be backed either by an
entry here or by a real provider class in main.py's PROVIDER_MAP. A name in
neither place is a phantom: the picker hides it, but the language rows still
advertise it as a supported provider.

These are declarations only: there is no provider class, and `main.py` never
constructs one.
"""

from providers.config import FeatureStatus, SupportedFeatures

_UNSUPPORTED = FeatureStatus.unsupported()


def _no_translation(name: str, model: str, reason: str) -> SupportedFeatures:
    """The upstream streaming API cannot translate, so this can never run."""
    return SupportedFeatures(
        name=name,
        model=model,
        text_translation=FeatureStatus.unsupported(comment=reason),
        speech_to_speech=FeatureStatus.unsupported(comment=reason),
        source_transcript=FeatureStatus.supported(),
        voice_selection=_UNSUPPORTED,
        single_multilingual_model=_UNSUPPORTED,
        language_hints=_UNSUPPORTED,
        language_identification=_UNSUPPORTED,
        speaker_diarization=_UNSUPPORTED,
        timestamps=_UNSUPPORTED,
        endpoint_detection=_UNSUPPORTED,
    )


UNSUPPORTED_PROVIDERS: dict[str, SupportedFeatures] = {
    "deepgram": _no_translation(
        "Deepgram",
        "nova-3",
        "Deepgram's streaming API transcribes only — it has no real-time "
        "translation, so it cannot take part in this comparison.",
    ),
    "assembly": _no_translation(
        "AssemblyAI",
        "Universal-3.5 Pro",
        "AssemblyAI's streaming API transcribes only — it has no real-time "
        "translation, so it cannot take part in this comparison.",
    ),
    "cartesia": _no_translation(
        "Cartesia",
        "ink-2",
        "Cartesia's streaming STT offers no translation, so it cannot take "
        "part in this comparison.",
    ),
    "elevenlabs": _no_translation(
        "ElevenLabs",
        "Scribe v2 Realtime",
        "ElevenLabs Scribe transcribes only — it has no real-time translation, "
        "so it cannot take part in this comparison.",
    ),
}
