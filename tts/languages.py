"""Language support shared by all providers.

Languages are identified by Soniox language codes (ISO-639-1). Each provider
entry maps a Soniox code to the code its API expects; a missing entry means
the provider either does not support the language (cartesia, azure,
elevenlabs, smallest, smallest_pro) or auto-detects it (openai).
"""

LANGUAGE_MAP: dict[str, dict[str, str]] = {
    "af": {"google": "af-ZA", "elevenlabs": "af", "azure": "af-ZA"},
    "sq": {"google": "sq-AL", "azure": "sq-AL"},
    "ar": {"google": "ar-EG", "elevenlabs": "ar", "cartesia": "ar", "azure": "ar-SA"},
    "az": {"google": "az-AZ", "elevenlabs": "az", "azure": "az-AZ"},
    "eu": {"google": "eu-ES", "azure": "eu-ES"},
    "be": {"google": "be-BY", "elevenlabs": "be"},
    "bn": {"google": "bn-BD", "elevenlabs": "bn", "cartesia": "bn", "azure": "bn-IN"},
    "bs": {"elevenlabs": "bs", "azure": "bs-BA"},  # Gemini TTS has no Bosnian
    "bg": {"google": "bg-BG", "elevenlabs": "bg", "cartesia": "bg", "azure": "bg-BG"},
    "ca": {"google": "ca-ES", "elevenlabs": "ca", "azure": "ca-ES"},
    "zh": {"google": "cmn-CN", "elevenlabs": "zh", "cartesia": "zh", "azure": "zh-CN"},
    "hr": {"google": "hr-HR", "elevenlabs": "hr", "cartesia": "hr", "azure": "hr-HR"},
    "cs": {"google": "cs-CZ", "elevenlabs": "cs", "cartesia": "cs", "azure": "cs-CZ"},
    "da": {"google": "da-DK", "elevenlabs": "da", "cartesia": "da", "azure": "da-DK"},
    "nl": {"google": "nl-NL", "elevenlabs": "nl", "cartesia": "nl", "azure": "nl-NL", "smallest": "nl"},
    "en": {"google": "en-US", "elevenlabs": "en", "cartesia": "en", "azure": "en-US", "smallest": "en", "smallest_pro": "en"},
    "et": {"google": "et-EE", "elevenlabs": "et", "azure": "et-EE"},
    "fi": {"google": "fi-FI", "elevenlabs": "fi", "cartesia": "fi", "azure": "fi-FI"},
    "fr": {"google": "fr-FR", "elevenlabs": "fr", "cartesia": "fr", "azure": "fr-FR", "smallest": "fr"},
    "gl": {"google": "gl-ES", "elevenlabs": "gl", "azure": "gl-ES"},
    "de": {"google": "de-DE", "elevenlabs": "de", "cartesia": "de", "azure": "de-DE", "smallest": "de"},
    "el": {"google": "el-GR", "elevenlabs": "el", "cartesia": "el", "azure": "el-GR"},
    "gu": {"google": "gu-IN", "elevenlabs": "gu", "cartesia": "gu", "azure": "gu-IN"},
    "he": {"google": "he-IL", "elevenlabs": "he", "cartesia": "he", "azure": "he-IL"},
    "hi": {"google": "hi-IN", "elevenlabs": "hi", "cartesia": "hi", "azure": "hi-IN", "smallest_pro": "hi"},
    "hu": {"google": "hu-HU", "elevenlabs": "hu", "cartesia": "hu", "azure": "hu-HU"},
    "id": {"google": "id-ID", "elevenlabs": "id", "cartesia": "id", "azure": "id-ID"},
    "it": {"google": "it-IT", "elevenlabs": "it", "cartesia": "it", "azure": "it-IT", "smallest": "it"},
    "ja": {"google": "ja-JP", "elevenlabs": "ja", "cartesia": "ja", "azure": "ja-JP"},
    "kn": {"google": "kn-IN", "elevenlabs": "kn", "cartesia": "kn", "azure": "kn-IN"},
    "kk": {"elevenlabs": "kk", "azure": "kk-KZ"},  # Gemini TTS has no Kazakh
    "ko": {"google": "ko-KR", "elevenlabs": "ko", "cartesia": "ko", "azure": "ko-KR"},
    "lv": {"google": "lv-LV", "elevenlabs": "lv", "azure": "lv-LV"},
    "lt": {"google": "lt-LT", "elevenlabs": "lt", "azure": "lt-LT"},
    "mk": {"google": "mk-MK", "elevenlabs": "mk", "azure": "mk-MK"},
    "ms": {"google": "ms-MY", "elevenlabs": "ms", "cartesia": "ms", "azure": "ms-MY"},
    "ml": {"google": "ml-IN", "elevenlabs": "ml", "cartesia": "ml", "azure": "ml-IN"},
    "mr": {"google": "mr-IN", "elevenlabs": "mr", "cartesia": "mr", "azure": "mr-IN"},
    "no": {"google": "nb-NO", "elevenlabs": "no", "cartesia": "no", "azure": "nb-NO"},
    "fa": {"google": "fa-IR", "elevenlabs": "fa", "azure": "fa-IR"},
    "pl": {"google": "pl-PL", "elevenlabs": "pl", "cartesia": "pl", "azure": "pl-PL", "smallest": "pl"},
    "pt": {"google": "pt-BR", "elevenlabs": "pt", "cartesia": "pt", "azure": "pt-BR", "smallest": "pt"},
    "pa": {"google": "pa-IN", "elevenlabs": "pa", "cartesia": "pa", "azure": "pa-IN"},
    "ro": {"google": "ro-RO", "elevenlabs": "ro", "cartesia": "ro", "azure": "ro-RO"},
    "ru": {"google": "ru-RU", "elevenlabs": "ru", "cartesia": "ru", "azure": "ru-RU", "smallest": "ru"},
    "sr": {"google": "sr-RS", "elevenlabs": "sr", "azure": "sr-RS"},
    "sk": {"google": "sk-SK", "elevenlabs": "sk", "cartesia": "sk", "azure": "sk-SK"},
    "sl": {"google": "sl-SI", "elevenlabs": "sl", "azure": "sl-SI"},
    "es": {"google": "es-ES", "elevenlabs": "es", "cartesia": "es", "azure": "es-ES", "smallest": "es"},
    "sw": {"google": "sw-KE", "elevenlabs": "sw", "azure": "sw-KE"},
    "sv": {"google": "sv-SE", "elevenlabs": "sv", "cartesia": "sv", "azure": "sv-SE", "smallest": "sv"},
    "tl": {"google": "fil-PH", "elevenlabs": "tl", "cartesia": "tl", "azure": "fil-PH"},
    "ta": {"google": "ta-IN", "elevenlabs": "ta", "cartesia": "ta", "azure": "ta-IN"},
    "te": {"google": "te-IN", "elevenlabs": "te", "cartesia": "te", "azure": "te-IN"},
    "th": {"google": "th-TH", "elevenlabs": "th", "cartesia": "th", "azure": "th-TH"},
    "tr": {"google": "tr-TR", "elevenlabs": "tr", "cartesia": "tr", "azure": "tr-TR"},
    "uk": {"google": "uk-UA", "elevenlabs": "uk", "cartesia": "uk", "azure": "uk-UA"},
    "ur": {"google": "ur-PK", "elevenlabs": "ur", "azure": "ur-PK"},
    "vi": {"google": "vi-VN", "elevenlabs": "vi", "cartesia": "vi", "azure": "vi-VN"},
    "cy": {"elevenlabs": "cy", "azure": "cy-GB"},  # Gemini TTS has no Welsh
}

SUPPORTED_LANGUAGES = list(LANGUAGE_MAP.keys())


def get_provider_language(language: str, provider: str) -> str | None:
    return LANGUAGE_MAP.get(language, {}).get(provider)


def is_language_supported(language: str, provider: str) -> bool:
    if language not in LANGUAGE_MAP:
        return False
    if provider == "soniox":
        return True
    # Cartesia, Azure, ElevenLabs, and Smallest AI (both pools) only support
    # languages with an explicit mapping; Google and OpenAI handle unmapped
    # languages gracefully.
    if provider in ("cartesia", "azure", "elevenlabs", "smallest", "smallest_pro"):
        return provider in LANGUAGE_MAP[language]
    return True
