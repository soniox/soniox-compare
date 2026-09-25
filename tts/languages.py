"""Language support shared by all providers.

Languages are identified by ISO-639-1 codes. Each provider entry maps that code
to the one its API expects, and a missing entry means the provider does not
support the language. The set of keys is the union of what the providers
support, not any one provider's list.

openai, fish and inworld take no language parameter — they infer it from the
text — so they are listed for every language (see AUTO_DETECT_PROVIDERS).
"""

LANGUAGE_MAP: dict[str, dict[str, str]] = {
    "af": {"google": "af-ZA", "soniox": "af", "elevenlabs": "af", "azure": "af-ZA"},
    "sq": {"google": "sq-AL", "soniox": "sq", "azure": "sq-AL"},
    "ar": {"google": "ar-EG", "soniox": "ar", "elevenlabs": "ar", "cartesia": "ar", "azure": "ar-SA", "xai": "ar-EG", "smallest": "ar", "smallest:pro": "ar"},
    "az": {"google": "az-AZ", "soniox": "az", "elevenlabs": "az", "azure": "az-AZ"},
    "eu": {"google": "eu-ES", "soniox": "eu", "azure": "eu-ES"},
    "be": {"google": "be-BY", "soniox": "be", "elevenlabs": "be"},
    "bn": {"google": "bn-BD", "soniox": "bn", "elevenlabs": "bn", "cartesia": "bn", "azure": "bn-IN", "xai": "bn", "smallest": "bn", "smallest:pro": "bn"},
    "bs": {"soniox": "bs", "elevenlabs": "bs", "azure": "bs-BA"},  # Gemini TTS has no Bosnian
    "bg": {"google": "bg-BG", "soniox": "bg", "elevenlabs": "bg", "cartesia": "bg", "azure": "bg-BG"},
    "ca": {"google": "ca-ES", "soniox": "ca", "elevenlabs": "ca", "azure": "ca-ES"},
    "zh": {"google": "cmn-CN", "soniox": "zh", "elevenlabs": "zh", "cartesia": "zh", "azure": "zh-CN", "xai": "zh", "smallest:pro": "zh"},
    "hr": {"google": "hr-HR", "soniox": "hr", "elevenlabs": "hr", "cartesia": "hr", "azure": "hr-HR"},
    "cs": {"google": "cs-CZ", "soniox": "cs", "elevenlabs": "cs", "cartesia": "cs", "azure": "cs-CZ"},
    "da": {"google": "da-DK", "soniox": "da", "elevenlabs": "da", "cartesia": "da", "azure": "da-DK"},
    "nl": {"deepgram": "aura-2-beatrix-nl", "google": "nl-NL", "soniox": "nl", "elevenlabs": "nl", "cartesia": "nl", "azure": "nl-NL", "smallest": "nl", "smallest:pro": "nl"},
    "en": {"deepgram": "aura-2-thalia-en", "google": "en-US", "soniox": "en", "elevenlabs": "en", "cartesia": "en", "azure": "en-US", "xai": "en", "smallest": "en", "smallest:pro": "en"},
    "et": {"google": "et-EE", "soniox": "et", "elevenlabs": "et", "azure": "et-EE"},
    "fi": {"google": "fi-FI", "soniox": "fi", "elevenlabs": "fi", "cartesia": "fi", "azure": "fi-FI", "smallest:pro": "fi"},
    "fr": {"deepgram": "aura-2-agathe-fr", "google": "fr-FR", "soniox": "fr", "elevenlabs": "fr", "cartesia": "fr", "azure": "fr-FR", "xai": "fr", "smallest": "fr", "smallest:pro": "fr"},
    "gl": {"google": "gl-ES", "soniox": "gl", "elevenlabs": "gl", "azure": "gl-ES"},
    "de": {"deepgram": "aura-2-aurelia-de", "google": "de-DE", "soniox": "de", "elevenlabs": "de", "cartesia": "de", "azure": "de-DE", "xai": "de", "smallest": "de", "smallest:pro": "de"},
    "el": {"google": "el-GR", "soniox": "el", "elevenlabs": "el", "cartesia": "el", "azure": "el-GR", "smallest:pro": "el"},
    "gu": {"google": "gu-IN", "soniox": "gu", "elevenlabs": "gu", "cartesia": "gu", "azure": "gu-IN", "smallest": "gu", "smallest:pro": "gu"},
    "he": {"google": "he-IL", "soniox": "he", "elevenlabs": "he", "cartesia": "he", "azure": "he-IL", "smallest": "he"},
    "hi": {"google": "hi-IN", "soniox": "hi", "elevenlabs": "hi", "cartesia": "hi", "azure": "hi-IN", "xai": "hi", "smallest": "hi", "smallest:pro": "hi"},
    "hu": {"google": "hu-HU", "soniox": "hu", "elevenlabs": "hu", "cartesia": "hu", "azure": "hu-HU"},
    "id": {"google": "id-ID", "soniox": "id", "elevenlabs": "id", "cartesia": "id", "azure": "id-ID", "xai": "id", "smallest:pro": "id"},
    "it": {"deepgram": "aura-2-cesare-it", "google": "it-IT", "soniox": "it", "elevenlabs": "it", "cartesia": "it", "azure": "it-IT", "xai": "it", "smallest": "it", "smallest:pro": "it"},
    "ja": {"deepgram": "aura-2-ama-ja", "google": "ja-JP", "soniox": "ja", "elevenlabs": "ja", "cartesia": "ja", "azure": "ja-JP", "xai": "ja", "smallest:pro": "ja"},
    "kn": {"google": "kn-IN", "soniox": "kn", "elevenlabs": "kn", "cartesia": "kn", "azure": "kn-IN", "smallest": "kn", "smallest:pro": "kn"},
    "kk": {"soniox": "kk", "elevenlabs": "kk", "azure": "kk-KZ"},  # Gemini TTS has no Kazakh
    "ko": {"google": "ko-KR", "soniox": "ko", "elevenlabs": "ko", "cartesia": "ko", "azure": "ko-KR", "xai": "ko", "smallest:pro": "ko"},
    "lv": {"google": "lv-LV", "soniox": "lv", "elevenlabs": "lv", "azure": "lv-LV"},
    "lt": {"google": "lt-LT", "soniox": "lt", "elevenlabs": "lt", "azure": "lt-LT"},
    "mk": {"google": "mk-MK", "soniox": "mk", "elevenlabs": "mk", "azure": "mk-MK"},
    "ms": {"google": "ms-MY", "soniox": "ms", "elevenlabs": "ms", "cartesia": "ms", "azure": "ms-MY", "smallest:pro": "ms"},
    "ml": {"google": "ml-IN", "soniox": "ml", "elevenlabs": "ml", "cartesia": "ml", "azure": "ml-IN", "smallest": "ml", "smallest:pro": "ml"},
    "mr": {"google": "mr-IN", "soniox": "mr", "elevenlabs": "mr", "cartesia": "mr", "azure": "mr-IN", "smallest": "mr", "smallest:pro": "mr"},
    "no": {"google": "nb-NO", "soniox": "no", "elevenlabs": "no", "cartesia": "no", "azure": "nb-NO", "smallest:pro": "no"},
    "fa": {"google": "fa-IR", "soniox": "fa", "elevenlabs": "fa", "azure": "fa-IR"},
    "pl": {"google": "pl-PL", "soniox": "pl", "elevenlabs": "pl", "cartesia": "pl", "azure": "pl-PL", "smallest": "pl", "smallest:pro": "pl"},
    "pt": {"google": "pt-BR", "soniox": "pt", "elevenlabs": "pt", "cartesia": "pt", "azure": "pt-BR", "xai": "pt-BR", "smallest": "pt", "smallest:pro": "pt"},
    # The pinned Azure omni voice returns near-silence for Gurmukhi text; pa-IN-OjasNeural speaks it.
    "pa": {"google": "pa-IN", "soniox": "pa", "elevenlabs": "pa", "cartesia": "pa", "smallest": "pa", "smallest:pro": "pa"},
    "ro": {"google": "ro-RO", "soniox": "ro", "elevenlabs": "ro", "cartesia": "ro", "azure": "ro-RO"},
    "ru": {"google": "ru-RU", "soniox": "ru", "elevenlabs": "ru", "cartesia": "ru", "azure": "ru-RU", "xai": "ru", "smallest": "ru", "smallest:pro": "ru"},
    "sr": {"google": "sr-RS", "soniox": "sr", "elevenlabs": "sr", "azure": "sr-RS"},
    "sk": {"google": "sk-SK", "soniox": "sk", "elevenlabs": "sk", "cartesia": "sk", "azure": "sk-SK"},
    "sl": {"google": "sl-SI", "soniox": "sl", "elevenlabs": "sl", "azure": "sl-SI"},
    "es": {"deepgram": "aura-2-agustina-es", "google": "es-ES", "soniox": "es", "elevenlabs": "es", "cartesia": "es", "azure": "es-ES", "xai": "es-ES", "smallest": "es", "smallest:pro": "es"},
    "sw": {"google": "sw-KE", "soniox": "sw", "elevenlabs": "sw", "azure": "sw-KE"},
    "sv": {"google": "sv-SE", "soniox": "sv", "elevenlabs": "sv", "cartesia": "sv", "azure": "sv-SE", "smallest": "sv", "smallest:pro": "sv"},
    # eleven_v3 takes "fil", not "tl".
    "tl": {"google": "fil-PH", "soniox": "tl", "elevenlabs": "fil", "cartesia": "tl", "azure": "fil-PH"},
    "ta": {"google": "ta-IN", "soniox": "ta", "elevenlabs": "ta", "cartesia": "ta", "azure": "ta-IN", "smallest": "ta", "smallest:pro": "ta"},
    "te": {"google": "te-IN", "soniox": "te", "elevenlabs": "te", "cartesia": "te", "azure": "te-IN", "smallest": "te", "smallest:pro": "te"},
    "th": {"google": "th-TH", "soniox": "th", "elevenlabs": "th", "cartesia": "th", "azure": "th-TH"},
    "tr": {"google": "tr-TR", "soniox": "tr", "elevenlabs": "tr", "cartesia": "tr", "azure": "tr-TR", "xai": "tr", "smallest:pro": "tr"},
    "uk": {"google": "uk-UA", "soniox": "uk", "elevenlabs": "uk", "cartesia": "uk", "azure": "uk-UA"},
    "ur": {"google": "ur-PK", "soniox": "ur", "elevenlabs": "ur", "cartesia": "ur", "azure": "ur-PK"},
    "vi": {"google": "vi-VN", "soniox": "vi", "elevenlabs": "vi", "cartesia": "vi", "azure": "vi-VN", "xai": "vi", "smallest:pro": "vi"},
    "cy": {"soniox": "cy", "elevenlabs": "cy", "azure": "cy-GB"},  # Gemini TTS has no Welsh
    "or": {"google": "or-IN", "cartesia": "or", "smallest:pro": "or"},  # Odia
    "hy": {"google": "hy-AM", "azure": "hy-AM", "elevenlabs": "hy"},  # Armenian
    "is": {"google": "is-IS", "azure": "is-IS", "elevenlabs": "is"},  # Icelandic
    "ka": {"google": "ka-GE", "azure": "ka-GE", "elevenlabs": "ka", "cartesia": "ka"},  # Georgian
    "ne": {"google": "ne-NP", "azure": "ne-NP", "elevenlabs": "ne"},  # Nepali
    "so": {"azure": "so-SO", "elevenlabs": "so"},  # Somali
    "as": {"azure": "as-IN", "elevenlabs": "as"},  # Assamese
    "ps": {"google": "ps-AF", "azure": "ps-AF", "elevenlabs": "ps"},  # Pashto
    "jv": {"azure": "jv-ID", "elevenlabs": "jv"},  # Javanese
    "ceb": {"google": "ceb-PH", "azure": "ceb-PH", "elevenlabs": "ceb"},  # Cebuano
    "ha": {"azure": "ha-NG", "elevenlabs": "ha"},  # Hausa
    "ga": {"azure": "ga-IE", "elevenlabs": "ga"},  # Irish
    "sd": {"google": "sd-IN", "elevenlabs": "sd"},  # Sindhi
    "ky": {"elevenlabs": "ky"},  # Kyrgyz
    "ny": {"azure": "ny-MW", "elevenlabs": "ny"},  # Chichewa
}

SUPPORTED_LANGUAGES = list(LANGUAGE_MAP.keys())

# Take no language parameter at all; served over /compare/api/config so the
# frontend can flag them.
AUTO_DETECT_PROVIDERS = ("openai", "fish", "inworld")


def get_provider_language(language: str, provider: str) -> str | None:
    return LANGUAGE_MAP.get(language, {}).get(provider)


def is_language_supported(language: str, provider: str) -> bool:
    if language not in LANGUAGE_MAP:
        return False
    # The providers below need an explicit mapping; the rest infer the language
    # from the text and take no language parameter at all.
    if provider in (
        "cartesia",
        "azure",
        "deepgram",
        "elevenlabs",
        "google",
        "smallest",
        "smallest:pro",
        "soniox",
        "xai",
    ):
        return provider in LANGUAGE_MAP[language]
    return True
