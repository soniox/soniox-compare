"""Per-provider language support, shared across all STT providers.

Keyed by canonical Soniox code (ISO-639-1) — the languages the comparison covers.
Each provider entry maps that code to the value the provider's streaming API
expects for it; a missing entry means the provider does not accept that language.
Soniox is omitted: the rendered list IS its own live model list, so it supports
every entry.
"""

LANGUAGE_MAP: dict[str, dict[str, str]] = {
    "af": {"soniox": "af", "azure": "af-ZA", "elevenlabs": "af", "google": "af-ZA", "openai": "af"},
    "ar": {"soniox": "ar", "assembly": "ar", "azure": "ar-AE", "deepgram": "ar", "elevenlabs": "ar", "google": "ar-EG", "inworld": "ar", "meta": "Arabic", "openai": "ar", "speechmatics": "ar", "xai": "ar"},
    "az": {"soniox": "az", "azure": "az-AZ", "elevenlabs": "az", "google": "az-AZ", "openai": "az"},
    "be": {"soniox": "be", "deepgram": "be", "elevenlabs": "be", "google": "be-BY", "openai": "be", "speechmatics": "be"},
    "bg": {"soniox": "bg", "azure": "bg-BG", "deepgram": "bg", "elevenlabs": "bg", "google": "bg-BG", "openai": "bg", "speechmatics": "bg"},
    "bn": {"soniox": "bn", "azure": "bn-IN", "deepgram": "bn", "elevenlabs": "bn", "google": "bn-IN", "meta": "Bengali", "smallest": "bn", "speechmatics": "bn"},
    "bs": {"soniox": "bs", "azure": "bs-BA", "deepgram": "bs", "elevenlabs": "bs", "google": "bs-BA", "openai": "bs"},
    "ca": {"soniox": "ca", "azure": "ca-ES", "deepgram": "ca", "elevenlabs": "ca", "google": "ca-ES", "openai": "ca", "speechmatics": "ca"},
    "cs": {"meta": "Czech", "soniox": "cs", "azure": "cs-CZ", "deepgram": "cs", "elevenlabs": "cs", "google": "cs-CZ", "inworld": "cs", "openai": "cs", "speechmatics": "cs", "xai": "cs"},
    "cy": {"soniox": "cy", "azure": "cy-GB", "elevenlabs": "cy", "openai": "cy", "speechmatics": "cy"},
    "da": {"meta": "Danish", "soniox": "da", "assembly": "da", "azure": "da-DK", "deepgram": "da", "elevenlabs": "da", "google": "da-DK", "inworld": "da", "openai": "da", "speechmatics": "da", "xai": "da"},
    "de": {"soniox": "de", "assembly": "de", "assembly:streaming": "de", "azure": "de-DE", "deepgram": "de", "elevenlabs": "de", "google": "de-DE", "inworld": "de", "meta": "German", "openai": "de", "smallest": "de", "speechmatics": "de", "xai": "de"},
    "el": {"soniox": "el", "azure": "el-GR", "deepgram": "el", "elevenlabs": "el", "google": "el-GR", "inworld": "el", "openai": "el", "speechmatics": "el"},
    "en": {"soniox": "en", "assembly": "en", "assembly:streaming": "en", "azure": "en-US", "cartesia": "en", "deepgram": "en", "elevenlabs": "en", "google": "en-US", "inworld": "en", "meta": "English", "openai": "en", "smallest": "en", "speechmatics": "en", "xai": "en"},
    "es": {"soniox": "es", "assembly": "es", "assembly:streaming": "es", "azure": "es-ES", "cartesia": "es", "deepgram": "es", "elevenlabs": "es", "google": "es-419", "inworld": "es", "meta": "Spanish", "openai": "es", "smallest": "es", "speechmatics": "es", "xai": "es"},
    "et": {"soniox": "et", "azure": "et-EE", "deepgram": "et", "elevenlabs": "et", "google": "et-EE", "openai": "et", "speechmatics": "et"},
    "eu": {"elevenlabs": "eu", "soniox": "eu", "azure": "eu-ES", "speechmatics": "eu"},
    "fa": {"soniox": "fa", "azure": "fa-IR", "deepgram": "fa", "elevenlabs": "fa", "google": "fa-IR", "inworld": "fa", "openai": "fa", "speechmatics": "fa", "xai": "fa"},
    "fi": {"meta": "Finnish", "soniox": "fi", "assembly": "fi", "azure": "fi-FI", "deepgram": "fi", "elevenlabs": "fi", "google": "fi-FI", "inworld": "fi", "openai": "fi", "speechmatics": "fi"},
    "fr": {"soniox": "fr", "assembly": "fr", "assembly:streaming": "fr", "azure": "fr-FR", "cartesia": "fr", "deepgram": "fr", "elevenlabs": "fr", "google": "fr-FR", "inworld": "fr", "meta": "French", "openai": "fr", "smallest": "fr", "speechmatics": "fr", "xai": "fr"},
    "gl": {"soniox": "gl", "azure": "gl-ES", "elevenlabs": "gl", "google": "gl-ES", "openai": "gl", "speechmatics": "gl"},
    "gu": {"soniox": "gu", "azure": "gu-IN", "deepgram": "gu", "elevenlabs": "gu", "google": "gu-IN", "smallest": "gu"},
    "he": {"soniox": "he", "assembly": "he", "azure": "he-IL", "deepgram": "he", "elevenlabs": "he", "google": "he-IL", "meta": "Hebrew", "openai": "he", "speechmatics": "he"},
    "hi": {"soniox": "hi", "assembly": "hi", "azure": "hi-IN", "cartesia": "hi", "deepgram": "hi", "elevenlabs": "hi", "google": "hi-IN", "inworld": "hi", "meta": "Hindi", "openai": "hi", "smallest": "hi", "speechmatics": "hi", "xai": "hi"},
    "hr": {"soniox": "hr", "azure": "hr-HR", "deepgram": "hr", "elevenlabs": "hr", "google": "hr-HR", "openai": "hr", "speechmatics": "hr"},
    "hu": {"soniox": "hu", "azure": "hu-HU", "deepgram": "hu", "elevenlabs": "hu", "google": "hu-HU", "inworld": "hu", "openai": "hu", "speechmatics": "hu"},
    "id": {"soniox": "id", "azure": "id-ID", "deepgram": "id", "elevenlabs": "id", "google": "id-ID", "inworld": "id", "meta": "Indonesian", "openai": "id", "speechmatics": "id", "xai": "id"},
    "it": {"soniox": "it", "assembly": "it", "assembly:streaming": "it", "azure": "it-IT", "deepgram": "it", "elevenlabs": "it", "google": "it-IT", "inworld": "it", "meta": "Italian", "openai": "it", "smallest": "it", "speechmatics": "it", "xai": "it"},
    "ja": {"soniox": "ja", "assembly": "ja", "azure": "ja-JP", "cartesia": "ja", "deepgram": "ja", "elevenlabs": "ja", "google": "ja-JP", "inworld": "ja", "meta": "Japanese", "openai": "ja", "smallest": "ja", "speechmatics": "ja", "xai": "ja"},
    "kk": {"soniox": "kk", "azure": "kk-KZ", "elevenlabs": "kk", "google": "kk-KZ", "openai": "kk"},
    "kn": {"soniox": "kn", "azure": "kn-IN", "deepgram": "kn", "elevenlabs": "kn", "google": "kn-IN", "meta": "Kannada", "openai": "kn", "smallest": "kn"},
    "ko": {"soniox": "ko", "azure": "ko-KR", "deepgram": "ko", "elevenlabs": "ko", "google": "ko-KR", "inworld": "ko", "meta": "Korean", "openai": "ko", "smallest": "ko", "speechmatics": "ko", "xai": "ko"},
    "lt": {"soniox": "lt", "azure": "lt-LT", "deepgram": "lt", "elevenlabs": "lt", "google": "lt-LT", "openai": "lt", "speechmatics": "lt"},
    "lv": {"soniox": "lv", "azure": "lv-LV", "deepgram": "lv", "elevenlabs": "lv", "google": "lv-LV", "openai": "lv", "speechmatics": "lv"},
    "mk": {"soniox": "mk", "azure": "mk-MK", "deepgram": "mk", "elevenlabs": "mk", "google": "mk-MK", "inworld": "mk", "openai": "mk", "xai": "mk"},
    "ml": {"soniox": "ml", "azure": "ml-IN", "elevenlabs": "ml", "google": "ml-IN", "smallest": "ml"},
    "mr": {"soniox": "mr", "azure": "mr-IN", "deepgram": "mr", "elevenlabs": "mr", "google": "mr-IN", "meta": "Marathi", "openai": "mr", "smallest": "mr", "speechmatics": "mr"},
    "ms": {"soniox": "ms", "azure": "ms-MY", "deepgram": "ms", "elevenlabs": "ms", "google": "ms-MY", "inworld": "ms", "meta": "Malay", "openai": "ms", "speechmatics": "ms", "xai": "ms"},
    "nl": {"soniox": "nl", "assembly": "nl", "azure": "nl-NL", "deepgram": "nl", "elevenlabs": "nl", "google": "nl-NL", "inworld": "nl", "meta": "Dutch", "openai": "nl", "smallest": "nl", "speechmatics": "nl", "xai": "nl"},
    "no": {"soniox": "no", "assembly": "no", "azure": "nb-NO", "deepgram": "no", "elevenlabs": "no", "google": "nb-NO", "openai": "no", "speechmatics": "no"},
    "pa": {"soniox": "pa", "azure": "pa-IN", "elevenlabs": "pa", "google": "pa-IN"},
    "pl": {"soniox": "pl", "azure": "pl-PL", "deepgram": "pl", "elevenlabs": "pl", "google": "pl-PL", "inworld": "pl", "meta": "Polish", "openai": "pl", "speechmatics": "pl", "xai": "pl"},
    "pt": {"soniox": "pt", "assembly": "pt", "assembly:streaming": "pt", "azure": "pt-PT", "deepgram": "pt", "elevenlabs": "pt", "google": "pt-BR", "inworld": "pt", "meta": "Portuguese", "openai": "pt", "smallest": "pt", "speechmatics": "pt", "xai": "pt"},
    "ro": {"meta": "Romanian", "soniox": "ro", "azure": "ro-RO", "deepgram": "ro", "elevenlabs": "ro", "google": "ro-RO", "inworld": "ro", "openai": "ro", "speechmatics": "ro", "xai": "ro"},
    "ru": {"soniox": "ru", "azure": "ru-RU", "deepgram": "ru", "elevenlabs": "ru", "google": "ru-RU", "inworld": "ru", "openai": "ru", "smallest": "ru", "speechmatics": "ru", "xai": "ru"},
    "sk": {"meta": "Slovak", "soniox": "sk", "azure": "sk-SK", "deepgram": "sk", "elevenlabs": "sk", "google": "sk-SK", "openai": "sk", "speechmatics": "sk"},
    "sl": {"soniox": "sl", "azure": "sl-SI", "deepgram": "sl", "elevenlabs": "sl", "google": "sl-SI", "openai": "sl", "speechmatics": "sl"},
    "sq": {"elevenlabs": "sq", "soniox": "sq", "azure": "sq-AL"},
    "sr": {"soniox": "sr", "azure": "sr-RS", "deepgram": "sr", "elevenlabs": "sr", "google": "sr-RS", "openai": "sr"},
    "sv": {"soniox": "sv", "assembly": "sv", "azure": "sv-SE", "deepgram": "sv", "elevenlabs": "sv", "google": "sv-SE", "inworld": "sv", "openai": "sv", "speechmatics": "sv", "xai": "sv"},
    "sw": {"soniox": "sw", "azure": "sw-KE", "elevenlabs": "sw", "google": "sw-KE", "openai": "sw", "speechmatics": "sw"},
    "ta": {"soniox": "ta", "azure": "ta-IN", "deepgram": "ta", "elevenlabs": "ta", "meta": "Tamil", "openai": "ta", "smallest": "ta", "speechmatics": "ta"},
    "te": {"soniox": "te", "azure": "te-IN", "deepgram": "te", "elevenlabs": "te", "google": "te-IN", "meta": "Telugu", "smallest": "te"},
    "th": {"soniox": "th", "azure": "th-TH", "deepgram": "th", "elevenlabs": "th", "google": "th-TH", "inworld": "th", "meta": "Thai", "openai": "th", "speechmatics": "th", "xai": "th"},
    "tl": {"soniox": "tl", "azure": "fil-PH", "deepgram": "tl", "elevenlabs": "fil", "google": "fil-PH", "inworld": "fil", "meta": "Tagalog", "openai": "tl", "xai": "fil"},
    "tr": {"soniox": "tr", "assembly": "tr", "azure": "tr-TR", "deepgram": "tr", "elevenlabs": "tr", "google": "tr-TR", "inworld": "tr", "meta": "Turkish", "openai": "tr", "speechmatics": "tr", "xai": "tr"},
    "uk": {"soniox": "uk", "azure": "uk-UA", "deepgram": "uk", "elevenlabs": "uk", "google": "uk-UA", "openai": "uk", "speechmatics": "uk"},
    "ur": {"soniox": "ur", "assembly": "ur", "azure": "ur-IN", "deepgram": "ur", "elevenlabs": "ur", "openai": "ur", "speechmatics": "ur"},
    "vi": {"soniox": "vi", "assembly": "vi", "azure": "vi-VN", "deepgram": "vi", "elevenlabs": "vi", "google": "vi-VN", "inworld": "vi", "meta": "Vietnamese", "openai": "vi", "speechmatics": "vi", "xai": "vi"},
    "zh": {"soniox": "zh", "assembly": "zh", "azure": "zh-CN", "deepgram": "zh", "elevenlabs": "zh", "google": "cmn-Hans-CN", "inworld": "zh", "meta": "Mandarin Chinese", "openai": "zh", "smallest": "zh", "speechmatics": "cmn"},
    "hy": {"azure": "hy-AM", "google": "hy-AM"},  # Armenian
    "is": {"azure": "is-IS", "google": "is-IS"},  # Icelandic
    "ne": {"azure": "ne-NP", "openai": "ne", "google": "ne-NP", "elevenlabs": "ne"},  # Nepali
    "ceb": {"elevenlabs": "ceb"},  # Cebuano
    "ka": {"azure": "ka-GE", "deepgram": "ka", "openai": "ka"},  # Georgian
    "as": {"deepgram": "as"},  # Assamese
    "mn": {"azure": "mn-MN", "deepgram": "mn"},  # Mongolian
    "ps": {"azure": "ps-AF", "deepgram": "ps"},  # Pashto
    "mi": {"openai": "mi"},  # Maori
    "yue": {"azure": "yue-CN", "openai": "yue"},  # Cantonese
    "am": {"azure": "am-ET"},  # Amharic
    "bho": {"azure": "bho-IN"},  # Bhojpuri
    "ga": {"azure": "ga-IE"},  # Irish
    "jv": {"elevenlabs": "jv", "azure": "jv-ID"},  # Javanese
    "km": {"azure": "km-KH"},  # Khmer
    "lo": {"azure": "lo-LA"},  # Lao
    "mt": {"azure": "mt-MT"},  # Maltese
    "my": {"azure": "my-MM"},  # Burmese
    "si": {"azure": "si-LK"},  # Sinhala
    "so": {"azure": "so-SO"},  # Somali
    "uz": {"azure": "uz-UZ"},  # Uzbek
    "wuu": {"azure": "wuu-CN"},  # Wu Chinese
    "zu": {"azure": "zu-ZA"},  # Zulu
}

SUPPORTED_LANGUAGES = list(LANGUAGE_MAP.keys())


def get_provider_language(language: str, provider: str) -> str | None:
    """The code `provider` wants for `language`, or None if unsupported."""
    return LANGUAGE_MAP.get(language, {}).get(provider)


def is_language_supported(language: str, provider: str) -> bool:
    return provider in LANGUAGE_MAP.get(language, {})
