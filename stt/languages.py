"""Per-provider language support, shared across all STT providers.

Keyed by canonical Soniox code (ISO-639-1) — the languages the comparison covers.
Each provider entry maps that code to the value the provider's streaming API
expects for it; a missing entry means the provider does not accept that language.
Soniox is omitted: the rendered list IS its own live model list, so it supports
every entry.
"""

LANGUAGE_MAP: dict[str, dict[str, str]] = {
    "af": {"azure": "af-ZA", "elevenlabs": "af", "google": "af-ZA", "openai": "af"},
    "ar": {"assembly": "ar", "azure": "ar-AE", "deepgram": "ar", "elevenlabs": "ar", "google": "ar-EG", "meta": "Arabic", "openai": "ar", "speechmatics": "ar"},
    "az": {"azure": "az-AZ", "elevenlabs": "az", "google": "az-AZ", "openai": "az"},
    "be": {"deepgram": "be", "elevenlabs": "be", "google": "be-BY", "openai": "be", "speechmatics": "be"},
    "bg": {"azure": "bg-BG", "deepgram": "bg", "elevenlabs": "bg", "google": "bg-BG", "openai": "bg", "speechmatics": "bg"},
    "bn": {"azure": "bn-IN", "deepgram": "bn", "elevenlabs": "bn", "google": "bn-IN", "meta": "Bengali", "smallest": "bn", "speechmatics": "bn"},
    "bs": {"azure": "bs-BA", "deepgram": "bs", "elevenlabs": "bs", "google": "bs-BA", "openai": "bs"},
    "ca": {"azure": "ca-ES", "deepgram": "ca", "elevenlabs": "ca", "google": "ca-ES", "openai": "ca", "speechmatics": "ca"},
    "cs": {"azure": "cs-CZ", "deepgram": "cs", "elevenlabs": "cs", "google": "cs-CZ", "openai": "cs", "speechmatics": "cs"},
    "cy": {"azure": "cy-GB", "elevenlabs": "cy", "openai": "cy", "speechmatics": "cy"},
    "da": {"assembly": "da", "azure": "da-DK", "deepgram": "da", "elevenlabs": "da", "google": "da-DK", "openai": "da", "speechmatics": "da"},
    "de": {"assembly": "de", "azure": "de-DE", "deepgram": "de", "elevenlabs": "de", "google": "de-DE", "meta": "German", "openai": "de", "smallest": "de", "speechmatics": "de"},
    "el": {"azure": "el-GR", "deepgram": "el", "elevenlabs": "el", "google": "el-GR", "openai": "el", "speechmatics": "el"},
    "en": {"assembly": "en", "azure": "en-US", "cartesia": "en", "deepgram": "en", "elevenlabs": "en", "google": "en-US", "meta": "English", "openai": "en", "smallest": "en", "speechmatics": "en"},
    "es": {"assembly": "es", "azure": "es-ES", "deepgram": "es", "elevenlabs": "es", "google": "es-419", "meta": "Spanish", "openai": "es", "smallest": "es", "speechmatics": "es"},
    "et": {"azure": "et-EE", "deepgram": "et", "elevenlabs": "et", "google": "et-EE", "openai": "et", "speechmatics": "et"},
    "eu": {"azure": "eu-ES", "speechmatics": "eu"},
    "fa": {"azure": "fa-IR", "deepgram": "fa", "elevenlabs": "fa", "google": "fa-IR", "openai": "fa", "speechmatics": "fa"},
    "fi": {"assembly": "fi", "azure": "fi-FI", "deepgram": "fi", "elevenlabs": "fi", "google": "fi-FI", "openai": "fi", "speechmatics": "fi"},
    "fr": {"assembly": "fr", "azure": "fr-FR", "deepgram": "fr", "elevenlabs": "fr", "google": "fr-FR", "meta": "French", "openai": "fr", "smallest": "fr", "speechmatics": "fr"},
    "gl": {"azure": "gl-ES", "elevenlabs": "gl", "google": "gl-ES", "openai": "gl", "speechmatics": "gl"},
    "gu": {"azure": "gu-IN", "deepgram": "gu", "elevenlabs": "gu", "google": "gu-IN", "smallest": "gu"},
    "he": {"assembly": "he", "azure": "he-IL", "deepgram": "he", "elevenlabs": "he", "google": "he-IL", "meta": "Hebrew", "openai": "he", "speechmatics": "he"},
    "hi": {"assembly": "hi", "azure": "hi-IN", "deepgram": "hi", "elevenlabs": "hi", "google": "hi-IN", "meta": "Hindi", "openai": "hi", "smallest": "hi", "speechmatics": "hi"},
    "hr": {"azure": "hr-HR", "deepgram": "hr", "elevenlabs": "hr", "google": "hr-HR", "openai": "hr", "speechmatics": "hr"},
    "hu": {"azure": "hu-HU", "deepgram": "hu", "elevenlabs": "hu", "google": "hu-HU", "openai": "hu", "speechmatics": "hu"},
    "id": {"azure": "id-ID", "deepgram": "id", "elevenlabs": "id", "google": "id-ID", "meta": "Indonesian", "openai": "id", "speechmatics": "id"},
    "it": {"assembly": "it", "azure": "it-IT", "deepgram": "it", "elevenlabs": "it", "google": "it-IT", "meta": "Italian", "openai": "it", "smallest": "it", "speechmatics": "it"},
    "ja": {"assembly": "ja", "azure": "ja-JP", "deepgram": "ja", "elevenlabs": "ja", "google": "ja-JP", "meta": "Japanese", "openai": "ja", "smallest": "ja", "speechmatics": "ja"},
    "kk": {"azure": "kk-KZ", "elevenlabs": "kk", "google": "kk-KZ", "openai": "kk"},
    "kn": {"azure": "kn-IN", "deepgram": "kn", "elevenlabs": "kn", "google": "kn-IN", "meta": "Kannada", "openai": "kn", "smallest": "kn"},
    "ko": {"azure": "ko-KR", "deepgram": "ko", "elevenlabs": "ko", "google": "ko-KR", "meta": "Korean", "openai": "ko", "smallest": "ko", "speechmatics": "ko"},
    "lt": {"azure": "lt-LT", "deepgram": "lt", "elevenlabs": "lt", "google": "lt-LT", "openai": "lt", "speechmatics": "lt"},
    "lv": {"azure": "lv-LV", "deepgram": "lv", "elevenlabs": "lv", "google": "lv-LV", "openai": "lv", "speechmatics": "lv"},
    "mk": {"azure": "mk-MK", "deepgram": "mk", "elevenlabs": "mk", "google": "mk-MK", "openai": "mk"},
    "ml": {"azure": "ml-IN", "elevenlabs": "ml", "google": "ml-IN", "smallest": "ml"},
    "mr": {"azure": "mr-IN", "deepgram": "mr", "elevenlabs": "mr", "google": "mr-IN", "meta": "Marathi", "openai": "mr", "smallest": "mr", "speechmatics": "mr"},
    "ms": {"azure": "ms-MY", "deepgram": "ms", "elevenlabs": "ms", "google": "ms-MY", "meta": "Malay", "openai": "ms", "speechmatics": "ms"},
    "nl": {"assembly": "nl", "azure": "nl-NL", "deepgram": "nl", "elevenlabs": "nl", "google": "nl-NL", "meta": "Dutch", "openai": "nl", "smallest": "nl", "speechmatics": "nl"},
    "no": {"assembly": "no", "azure": "nb-NO", "deepgram": "no", "elevenlabs": "no", "google": "nb-NO", "openai": "no", "speechmatics": "no"},
    "pa": {"azure": "pa-IN", "elevenlabs": "pa", "google": "pa-IN"},
    "pl": {"azure": "pl-PL", "deepgram": "pl", "elevenlabs": "pl", "google": "pl-PL", "meta": "Polish", "openai": "pl", "speechmatics": "pl"},
    "pt": {"assembly": "pt", "azure": "pt-PT", "deepgram": "pt", "elevenlabs": "pt", "google": "pt-BR", "meta": "Portuguese", "openai": "pt", "smallest": "pt", "speechmatics": "pt"},
    "ro": {"azure": "ro-RO", "deepgram": "ro", "elevenlabs": "ro", "google": "ro-RO", "openai": "ro", "speechmatics": "ro"},
    "ru": {"azure": "ru-RU", "deepgram": "ru", "elevenlabs": "ru", "google": "ru-RU", "openai": "ru", "smallest": "ru", "speechmatics": "ru"},
    "sk": {"azure": "sk-SK", "deepgram": "sk", "elevenlabs": "sk", "google": "sk-SK", "openai": "sk", "speechmatics": "sk"},
    "sl": {"azure": "sl-SI", "deepgram": "sl", "elevenlabs": "sl", "google": "sl-SI", "openai": "sl", "speechmatics": "sl"},
    "sq": {"azure": "sq-AL"},
    "sr": {"azure": "sr-RS", "deepgram": "sr", "elevenlabs": "sr", "google": "sr-RS", "openai": "sr"},
    "sv": {"assembly": "sv", "azure": "sv-SE", "deepgram": "sv", "elevenlabs": "sv", "google": "sv-SE", "openai": "sv", "speechmatics": "sv"},
    "sw": {"azure": "sw-KE", "elevenlabs": "sw", "google": "sw-KE", "openai": "sw", "speechmatics": "sw"},
    "ta": {"azure": "ta-IN", "deepgram": "ta", "elevenlabs": "ta", "meta": "Tamil", "openai": "ta", "smallest": "ta", "speechmatics": "ta"},
    "te": {"azure": "te-IN", "deepgram": "te", "elevenlabs": "te", "google": "te-IN", "meta": "Telugu", "smallest": "te"},
    "th": {"azure": "th-TH", "deepgram": "th", "elevenlabs": "th", "google": "th-TH", "meta": "Thai", "openai": "th", "speechmatics": "th"},
    "tl": {"azure": "fil-PH", "deepgram": "tl", "elevenlabs": "tl", "google": "fil-PH", "meta": "Tagalog", "openai": "tl"},
    "tr": {"assembly": "tr", "azure": "tr-TR", "deepgram": "tr", "elevenlabs": "tr", "google": "tr-TR", "meta": "Turkish", "openai": "tr", "speechmatics": "tr"},
    "uk": {"azure": "uk-UA", "deepgram": "uk", "elevenlabs": "uk", "google": "uk-UA", "openai": "uk", "speechmatics": "uk"},
    "ur": {"assembly": "ur", "azure": "ur-IN", "deepgram": "ur", "elevenlabs": "ur", "openai": "ur", "speechmatics": "ur"},
    "vi": {"assembly": "vi", "azure": "vi-VN", "deepgram": "vi", "elevenlabs": "vi", "google": "vi-VN", "meta": "Vietnamese", "openai": "vi", "speechmatics": "vi"},
    "zh": {"assembly": "zh", "azure": "zh-CN", "deepgram": "zh", "elevenlabs": "zh", "google": "cmn-Hans-CN", "meta": "Mandarin Chinese", "openai": "zh", "smallest": "zh", "speechmatics": "cmn"},
}

SUPPORTED_LANGUAGES = list(LANGUAGE_MAP.keys())


def get_provider_language(language: str, provider: str) -> str | None:
    """The code `provider` wants for `language`, or None if unsupported."""
    return LANGUAGE_MAP.get(language, {}).get(provider)


def is_language_supported(language: str, provider: str) -> bool:
    return provider in LANGUAGE_MAP.get(language, {})
