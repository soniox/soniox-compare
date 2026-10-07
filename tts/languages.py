"""Language support shared by all providers.

Languages are identified by ISO-639-1 codes. Each provider entry maps that code
to the one its API expects, and a missing entry means the provider does not
support the language. The set of keys is the union of what the providers
support, not any one provider's list.

openai, fish and inworld take no language parameter — they infer it from the
text — so they are listed for every language (see AUTO_DETECT_PROVIDERS).
"""

LANGUAGE_MAP: dict[str, dict[str, str]] = {
    "af": {"google": "af-ZA", "google:3.8-flash": "af-ZA", "google:3.8-flash-lite": "af-ZA", "google:3.1-flash": "af-ZA", "soniox": "af", "elevenlabs": "af", "elevenlabs:v4": "af", "azure": "af-ZA"},
    "sq": {"google": "sq-AL", "google:3.8-flash": "sq-AL", "google:3.8-flash-lite": "sq-AL", "google:3.1-flash": "sq-AL", "soniox": "sq", "azure": "sq-AL"},
    "ar": {"google": "ar-EG", "google:3.8-flash": "ar-EG", "google:3.8-flash-lite": "ar-EG", "google:3.1-flash": "ar-EG", "soniox": "ar", "elevenlabs": "ar", "elevenlabs:v4": "ar", "cartesia": "ar", "azure": "ar-SA", "xai": "ar-EG", "smallest": "ar", "smallest:pro": "ar"},
    "az": {"google": "az-AZ", "google:3.8-flash": "az-AZ", "google:3.8-flash-lite": "az-AZ", "google:3.1-flash": "az-AZ", "soniox": "az", "elevenlabs": "az", "elevenlabs:v4": "az", "azure": "az-AZ"},
    "eu": {"google": "eu-ES", "google:3.8-flash": "eu-ES", "google:3.8-flash-lite": "eu-ES", "google:3.1-flash": "eu-ES", "soniox": "eu", "azure": "eu-ES"},
    "be": {"google": "be-BY", "google:3.8-flash": "be-BY", "google:3.8-flash-lite": "be-BY", "google:3.1-flash": "be-BY", "soniox": "be", "elevenlabs": "be", "elevenlabs:v4": "be"},
    "bn": {"google": "bn-BD", "google:3.8-flash": "bn-BD", "google:3.8-flash-lite": "bn-BD", "google:3.1-flash": "bn-BD", "soniox": "bn", "elevenlabs": "bn", "elevenlabs:v4": "bn", "cartesia": "bn", "azure": "bn-IN", "xai": "bn", "smallest": "bn", "smallest:pro": "bn"},
    "bs": {"google:3.8-flash": "bs-BA", "google:3.8-flash-lite": "bs-BA", "google:3.1-flash": "bs-BA", "soniox": "bs", "elevenlabs": "bs", "elevenlabs:v4": "bs", "azure": "bs-BA"},  # Gemini 2.5 TTS has no Bosnian
    "bg": {"google": "bg-BG", "google:3.8-flash": "bg-BG", "google:3.8-flash-lite": "bg-BG", "google:3.1-flash": "bg-BG", "soniox": "bg", "elevenlabs": "bg", "elevenlabs:v4": "bg", "cartesia": "bg", "azure": "bg-BG"},
    "ca": {"google": "ca-ES", "google:3.8-flash": "ca-ES", "google:3.8-flash-lite": "ca-ES", "google:3.1-flash": "ca-ES", "soniox": "ca", "elevenlabs": "ca", "elevenlabs:v4": "ca", "azure": "ca-ES"},
    "zh": {"google": "cmn-CN", "google:3.8-flash": "cmn-CN", "google:3.8-flash-lite": "cmn-CN", "google:3.1-flash": "cmn-CN", "soniox": "zh", "elevenlabs": "zh", "elevenlabs:v4": "zh", "cartesia": "zh", "azure": "zh-CN", "xai": "zh", "smallest:pro": "zh"},
    "hr": {"google": "hr-HR", "google:3.8-flash": "hr-HR", "google:3.8-flash-lite": "hr-HR", "google:3.1-flash": "hr-HR", "soniox": "hr", "elevenlabs": "hr", "elevenlabs:v4": "hr", "cartesia": "hr", "azure": "hr-HR"},
    "cs": {"google": "cs-CZ", "google:3.8-flash": "cs-CZ", "google:3.8-flash-lite": "cs-CZ", "google:3.1-flash": "cs-CZ", "soniox": "cs", "elevenlabs": "cs", "elevenlabs:v4": "cs", "cartesia": "cs", "azure": "cs-CZ"},
    "da": {"google": "da-DK", "google:3.8-flash": "da-DK", "google:3.8-flash-lite": "da-DK", "google:3.1-flash": "da-DK", "soniox": "da", "elevenlabs": "da", "elevenlabs:v4": "da", "cartesia": "da", "azure": "da-DK"},
    "nl": {"deepgram": "aura-2-beatrix-nl", "google": "nl-NL", "google:3.8-flash": "nl-NL", "google:3.8-flash-lite": "nl-NL", "google:3.1-flash": "nl-NL", "soniox": "nl", "elevenlabs": "nl", "elevenlabs:v4": "nl", "cartesia": "nl", "azure": "nl-NL", "smallest": "nl", "smallest:pro": "nl"},
    "en": {"deepgram": "aura-2-thalia-en", "google": "en-US", "google:3.8-flash": "en-US", "google:3.8-flash-lite": "en-US", "google:3.1-flash": "en-US", "soniox": "en", "elevenlabs": "en", "elevenlabs:v4": "en", "cartesia": "en", "azure": "en-US", "xai": "en", "smallest": "en", "smallest:pro": "en"},
    "et": {"google": "et-EE", "google:3.8-flash": "et-EE", "google:3.8-flash-lite": "et-EE", "google:3.1-flash": "et-EE", "soniox": "et", "elevenlabs": "et", "elevenlabs:v4": "et", "azure": "et-EE"},
    "fi": {"google": "fi-FI", "google:3.8-flash": "fi-FI", "google:3.8-flash-lite": "fi-FI", "google:3.1-flash": "fi-FI", "soniox": "fi", "elevenlabs": "fi", "elevenlabs:v4": "fi", "cartesia": "fi", "azure": "fi-FI", "smallest:pro": "fi"},
    "fr": {"deepgram": "aura-2-agathe-fr", "google": "fr-FR", "google:3.8-flash": "fr-FR", "google:3.8-flash-lite": "fr-FR", "google:3.1-flash": "fr-FR", "soniox": "fr", "elevenlabs": "fr", "elevenlabs:v4": "fr", "cartesia": "fr", "azure": "fr-FR", "xai": "fr", "smallest": "fr", "smallest:pro": "fr"},
    "gl": {"google": "gl-ES", "google:3.8-flash": "gl-ES", "google:3.8-flash-lite": "gl-ES", "google:3.1-flash": "gl-ES", "soniox": "gl", "elevenlabs": "gl", "elevenlabs:v4": "gl", "azure": "gl-ES"},
    "de": {"deepgram": "aura-2-aurelia-de", "google": "de-DE", "google:3.8-flash": "de-DE", "google:3.8-flash-lite": "de-DE", "google:3.1-flash": "de-DE", "soniox": "de", "elevenlabs": "de", "elevenlabs:v4": "de", "cartesia": "de", "azure": "de-DE", "xai": "de", "smallest": "de", "smallest:pro": "de"},
    "el": {"google": "el-GR", "google:3.8-flash": "el-GR", "google:3.8-flash-lite": "el-GR", "google:3.1-flash": "el-GR", "soniox": "el", "elevenlabs": "el", "elevenlabs:v4": "el", "cartesia": "el", "azure": "el-GR", "smallest:pro": "el"},
    "gu": {"google": "gu-IN", "google:3.8-flash": "gu-IN", "google:3.8-flash-lite": "gu-IN", "google:3.1-flash": "gu-IN", "soniox": "gu", "elevenlabs": "gu", "elevenlabs:v4": "gu", "cartesia": "gu", "azure": "gu-IN", "smallest": "gu", "smallest:pro": "gu"},
    "he": {"google": "he-IL", "google:3.8-flash": "he-IL", "google:3.8-flash-lite": "he-IL", "google:3.1-flash": "he-IL", "soniox": "he", "elevenlabs": "he", "elevenlabs:v4": "he", "cartesia": "he", "azure": "he-IL", "smallest": "he"},
    "hi": {"google": "hi-IN", "google:3.8-flash": "hi-IN", "google:3.8-flash-lite": "hi-IN", "google:3.1-flash": "hi-IN", "soniox": "hi", "elevenlabs": "hi", "elevenlabs:v4": "hi", "cartesia": "hi", "azure": "hi-IN", "xai": "hi", "smallest": "hi", "smallest:pro": "hi"},
    "hu": {"google": "hu-HU", "google:3.8-flash": "hu-HU", "google:3.8-flash-lite": "hu-HU", "google:3.1-flash": "hu-HU", "soniox": "hu", "elevenlabs": "hu", "elevenlabs:v4": "hu", "cartesia": "hu", "azure": "hu-HU"},
    "id": {"google": "id-ID", "google:3.8-flash": "id-ID", "google:3.8-flash-lite": "id-ID", "google:3.1-flash": "id-ID", "soniox": "id", "elevenlabs": "id", "elevenlabs:v4": "id", "cartesia": "id", "azure": "id-ID", "xai": "id", "smallest:pro": "id"},
    "it": {"deepgram": "aura-2-cesare-it", "google": "it-IT", "google:3.8-flash": "it-IT", "google:3.8-flash-lite": "it-IT", "google:3.1-flash": "it-IT", "soniox": "it", "elevenlabs": "it", "elevenlabs:v4": "it", "cartesia": "it", "azure": "it-IT", "xai": "it", "smallest": "it", "smallest:pro": "it"},
    "ja": {"deepgram": "aura-2-ama-ja", "google": "ja-JP", "google:3.8-flash": "ja-JP", "google:3.8-flash-lite": "ja-JP", "google:3.1-flash": "ja-JP", "soniox": "ja", "elevenlabs": "ja", "elevenlabs:v4": "ja", "cartesia": "ja", "azure": "ja-JP", "xai": "ja", "smallest:pro": "ja"},
    "kn": {"google": "kn-IN", "google:3.8-flash": "kn-IN", "google:3.8-flash-lite": "kn-IN", "google:3.1-flash": "kn-IN", "soniox": "kn", "elevenlabs": "kn", "elevenlabs:v4": "kn", "cartesia": "kn", "azure": "kn-IN", "smallest": "kn", "smallest:pro": "kn"},
    "kk": {"google:3.8-flash": "kk-KZ", "google:3.8-flash-lite": "kk-KZ", "google:3.1-flash": "kk-KZ", "soniox": "kk", "elevenlabs": "kk", "elevenlabs:v4": "kk", "azure": "kk-KZ"},  # Gemini 2.5 TTS has no Kazakh
    "ko": {"google": "ko-KR", "google:3.8-flash": "ko-KR", "google:3.8-flash-lite": "ko-KR", "google:3.1-flash": "ko-KR", "soniox": "ko", "elevenlabs": "ko", "elevenlabs:v4": "ko", "cartesia": "ko", "azure": "ko-KR", "xai": "ko", "smallest:pro": "ko"},
    "lv": {"google": "lv-LV", "google:3.8-flash": "lv-LV", "google:3.8-flash-lite": "lv-LV", "google:3.1-flash": "lv-LV", "soniox": "lv", "elevenlabs": "lv", "elevenlabs:v4": "lv", "azure": "lv-LV"},
    "lt": {"google": "lt-LT", "google:3.8-flash": "lt-LT", "google:3.8-flash-lite": "lt-LT", "google:3.1-flash": "lt-LT", "soniox": "lt", "elevenlabs": "lt", "elevenlabs:v4": "lt", "azure": "lt-LT"},
    "mk": {"google": "mk-MK", "google:3.8-flash": "mk-MK", "google:3.8-flash-lite": "mk-MK", "google:3.1-flash": "mk-MK", "soniox": "mk", "elevenlabs": "mk", "elevenlabs:v4": "mk", "azure": "mk-MK"},
    "ms": {"google": "ms-MY", "google:3.8-flash": "ms-MY", "google:3.8-flash-lite": "ms-MY", "google:3.1-flash": "ms-MY", "soniox": "ms", "elevenlabs": "ms", "elevenlabs:v4": "ms", "cartesia": "ms", "azure": "ms-MY", "smallest:pro": "ms"},
    "ml": {"google": "ml-IN", "google:3.8-flash": "ml-IN", "google:3.8-flash-lite": "ml-IN", "google:3.1-flash": "ml-IN", "soniox": "ml", "elevenlabs": "ml", "elevenlabs:v4": "ml", "cartesia": "ml", "azure": "ml-IN", "smallest": "ml", "smallest:pro": "ml"},
    "mr": {"google": "mr-IN", "google:3.8-flash": "mr-IN", "google:3.8-flash-lite": "mr-IN", "google:3.1-flash": "mr-IN", "soniox": "mr", "elevenlabs": "mr", "elevenlabs:v4": "mr", "cartesia": "mr", "azure": "mr-IN", "smallest": "mr", "smallest:pro": "mr"},
    "no": {"google": "nb-NO", "google:3.8-flash": "nb-NO", "google:3.8-flash-lite": "nb-NO", "google:3.1-flash": "nb-NO", "soniox": "no", "elevenlabs": "no", "elevenlabs:v4": "no", "cartesia": "no", "azure": "nb-NO", "smallest:pro": "no"},
    "fa": {"google": "fa-IR", "google:3.8-flash": "fa-IR", "google:3.8-flash-lite": "fa-IR", "google:3.1-flash": "fa-IR", "soniox": "fa", "elevenlabs": "fa", "elevenlabs:v4": "fa", "azure": "fa-IR"},
    "pl": {"google": "pl-PL", "google:3.8-flash": "pl-PL", "google:3.8-flash-lite": "pl-PL", "google:3.1-flash": "pl-PL", "soniox": "pl", "elevenlabs": "pl", "elevenlabs:v4": "pl", "cartesia": "pl", "azure": "pl-PL", "smallest": "pl", "smallest:pro": "pl"},
    "pt": {"google": "pt-BR", "google:3.8-flash": "pt-BR", "google:3.8-flash-lite": "pt-BR", "google:3.1-flash": "pt-BR", "soniox": "pt", "elevenlabs": "pt", "elevenlabs:v4": "pt", "cartesia": "pt", "azure": "pt-BR", "xai": "pt-BR", "smallest": "pt", "smallest:pro": "pt"},
    # The pinned Azure omni voice returns near-silence for Gurmukhi text; pa-IN-OjasNeural speaks it.
    "pa": {"google": "pa-IN", "google:3.8-flash": "pa-IN", "google:3.8-flash-lite": "pa-IN", "google:3.1-flash": "pa-IN", "soniox": "pa", "elevenlabs": "pa", "elevenlabs:v4": "pa", "cartesia": "pa", "smallest": "pa", "smallest:pro": "pa"},
    "ro": {"google": "ro-RO", "google:3.8-flash": "ro-RO", "google:3.8-flash-lite": "ro-RO", "google:3.1-flash": "ro-RO", "soniox": "ro", "elevenlabs": "ro", "elevenlabs:v4": "ro", "cartesia": "ro", "azure": "ro-RO"},
    "ru": {"google": "ru-RU", "google:3.8-flash": "ru-RU", "google:3.8-flash-lite": "ru-RU", "google:3.1-flash": "ru-RU", "soniox": "ru", "elevenlabs": "ru", "elevenlabs:v4": "ru", "cartesia": "ru", "azure": "ru-RU", "xai": "ru", "smallest": "ru", "smallest:pro": "ru"},
    "sr": {"google": "sr-RS", "google:3.8-flash": "sr-RS", "google:3.8-flash-lite": "sr-RS", "google:3.1-flash": "sr-RS", "soniox": "sr", "elevenlabs": "sr", "elevenlabs:v4": "sr", "azure": "sr-RS"},
    "sk": {"google": "sk-SK", "google:3.8-flash": "sk-SK", "google:3.8-flash-lite": "sk-SK", "google:3.1-flash": "sk-SK", "soniox": "sk", "elevenlabs": "sk", "elevenlabs:v4": "sk", "cartesia": "sk", "azure": "sk-SK"},
    "sl": {"google": "sl-SI", "google:3.8-flash": "sl-SI", "google:3.8-flash-lite": "sl-SI", "google:3.1-flash": "sl-SI", "soniox": "sl", "elevenlabs": "sl", "elevenlabs:v4": "sl", "azure": "sl-SI"},
    "es": {"deepgram": "aura-2-agustina-es", "google": "es-ES", "google:3.8-flash": "es-ES", "google:3.8-flash-lite": "es-ES", "google:3.1-flash": "es-ES", "soniox": "es", "elevenlabs": "es", "elevenlabs:v4": "es", "cartesia": "es", "azure": "es-ES", "xai": "es-ES", "smallest": "es", "smallest:pro": "es"},
    "sw": {"google": "sw-KE", "google:3.8-flash": "sw-KE", "google:3.8-flash-lite": "sw-KE", "google:3.1-flash": "sw-KE", "soniox": "sw", "elevenlabs": "sw", "elevenlabs:v4": "sw", "azure": "sw-KE"},
    "sv": {"google": "sv-SE", "google:3.8-flash": "sv-SE", "google:3.8-flash-lite": "sv-SE", "google:3.1-flash": "sv-SE", "soniox": "sv", "elevenlabs": "sv", "elevenlabs:v4": "sv", "cartesia": "sv", "azure": "sv-SE", "smallest": "sv", "smallest:pro": "sv"},
    # eleven_v3 and eleven_v4 take "fil", not "tl".
    "tl": {"google": "fil-PH", "google:3.8-flash": "fil-PH", "google:3.8-flash-lite": "fil-PH", "google:3.1-flash": "fil-PH", "soniox": "tl", "elevenlabs": "fil", "elevenlabs:v4": "fil", "cartesia": "tl", "azure": "fil-PH"},
    "ta": {"google": "ta-IN", "google:3.8-flash": "ta-IN", "google:3.8-flash-lite": "ta-IN", "google:3.1-flash": "ta-IN", "soniox": "ta", "elevenlabs": "ta", "elevenlabs:v4": "ta", "cartesia": "ta", "azure": "ta-IN", "smallest": "ta", "smallest:pro": "ta"},
    "te": {"google": "te-IN", "google:3.8-flash": "te-IN", "google:3.8-flash-lite": "te-IN", "google:3.1-flash": "te-IN", "soniox": "te", "elevenlabs": "te", "elevenlabs:v4": "te", "cartesia": "te", "azure": "te-IN", "smallest": "te", "smallest:pro": "te"},
    "th": {"google": "th-TH", "google:3.8-flash": "th-TH", "google:3.8-flash-lite": "th-TH", "google:3.1-flash": "th-TH", "soniox": "th", "elevenlabs": "th", "elevenlabs:v4": "th", "cartesia": "th", "azure": "th-TH"},
    "tr": {"google": "tr-TR", "google:3.8-flash": "tr-TR", "google:3.8-flash-lite": "tr-TR", "google:3.1-flash": "tr-TR", "soniox": "tr", "elevenlabs": "tr", "elevenlabs:v4": "tr", "cartesia": "tr", "azure": "tr-TR", "xai": "tr", "smallest:pro": "tr"},
    "uk": {"google": "uk-UA", "google:3.8-flash": "uk-UA", "google:3.8-flash-lite": "uk-UA", "google:3.1-flash": "uk-UA", "soniox": "uk", "elevenlabs": "uk", "elevenlabs:v4": "uk", "cartesia": "uk", "azure": "uk-UA"},
    "ur": {"google": "ur-PK", "google:3.8-flash": "ur-PK", "google:3.8-flash-lite": "ur-PK", "google:3.1-flash": "ur-PK", "soniox": "ur", "elevenlabs": "ur", "elevenlabs:v4": "ur", "cartesia": "ur", "azure": "ur-PK"},
    "vi": {"google": "vi-VN", "google:3.8-flash": "vi-VN", "google:3.8-flash-lite": "vi-VN", "google:3.1-flash": "vi-VN", "soniox": "vi", "elevenlabs": "vi", "elevenlabs:v4": "vi", "cartesia": "vi", "azure": "vi-VN", "xai": "vi", "smallest:pro": "vi"},
    "cy": {"google:3.8-flash": "cy-GB", "google:3.8-flash-lite": "cy-GB", "google:3.1-flash": "cy-GB", "soniox": "cy", "elevenlabs": "cy", "elevenlabs:v4": "cy", "azure": "cy-GB"},  # Gemini 2.5 TTS has no Welsh
    "or": {"google": "or-IN", "google:3.8-flash": "or-IN", "google:3.8-flash-lite": "or-IN", "google:3.1-flash": "or-IN", "cartesia": "or", "smallest:pro": "or", "elevenlabs:v4": "or"},  # Odia
    "hy": {"google": "hy-AM", "google:3.8-flash": "hy-AM", "google:3.8-flash-lite": "hy-AM", "google:3.1-flash": "hy-AM", "azure": "hy-AM", "elevenlabs": "hy", "elevenlabs:v4": "hy"},  # Armenian
    "is": {"google": "is-IS", "google:3.8-flash": "is-IS", "google:3.8-flash-lite": "is-IS", "google:3.1-flash": "is-IS", "azure": "is-IS", "elevenlabs": "is", "elevenlabs:v4": "is"},  # Icelandic
    "ka": {"google": "ka-GE", "google:3.8-flash": "ka-GE", "google:3.8-flash-lite": "ka-GE", "google:3.1-flash": "ka-GE", "azure": "ka-GE", "elevenlabs": "ka", "elevenlabs:v4": "ka", "cartesia": "ka"},  # Georgian
    "ne": {"google": "ne-NP", "google:3.8-flash": "ne-NP", "google:3.8-flash-lite": "ne-NP", "google:3.1-flash": "ne-NP", "azure": "ne-NP", "elevenlabs": "ne", "elevenlabs:v4": "ne"},  # Nepali
    "so": {"google:3.8-flash": "so-SO", "google:3.8-flash-lite": "so-SO", "google:3.1-flash": "so-SO", "azure": "so-SO", "elevenlabs": "so", "elevenlabs:v4": "so"},  # Somali
    "as": {"google:3.8-flash": "as-IN", "google:3.8-flash-lite": "as-IN", "google:3.1-flash": "as-IN", "azure": "as-IN", "elevenlabs": "as", "elevenlabs:v4": "as"},  # Assamese
    "ps": {"google": "ps-AF", "google:3.8-flash": "ps-AF", "google:3.8-flash-lite": "ps-AF", "google:3.1-flash": "ps-AF", "azure": "ps-AF", "elevenlabs": "ps", "elevenlabs:v4": "ps"},  # Pashto
    "jv": {"google:3.8-flash": "jv-ID", "google:3.8-flash-lite": "jv-ID", "google:3.1-flash": "jv-ID", "azure": "jv-ID", "elevenlabs": "jv", "elevenlabs:v4": "jv"},  # Javanese
    "ceb": {"google": "ceb-PH", "google:3.8-flash": "ceb-PH", "google:3.8-flash-lite": "ceb-PH", "google:3.1-flash": "ceb-PH", "azure": "ceb-PH", "elevenlabs": "ceb", "elevenlabs:v4": "ceb"},  # Cebuano
    "ha": {"google:3.8-flash": "ha-NG", "google:3.8-flash-lite": "ha-NG", "google:3.1-flash": "ha-NG", "azure": "ha-NG", "elevenlabs": "ha", "elevenlabs:v4": "ha"},  # Hausa
    "ga": {"google:3.8-flash": "ga-IE", "google:3.8-flash-lite": "ga-IE", "google:3.1-flash": "ga-IE", "azure": "ga-IE", "elevenlabs": "ga", "elevenlabs:v4": "ga"},  # Irish
    "sd": {"google": "sd-IN", "google:3.8-flash": "sd-IN", "google:3.8-flash-lite": "sd-IN", "google:3.1-flash": "sd-IN", "elevenlabs": "sd", "elevenlabs:v4": "sd"},  # Sindhi
    "ky": {"google:3.8-flash": "ky-KG", "google:3.8-flash-lite": "ky-KG", "google:3.1-flash": "ky-KG", "elevenlabs": "ky", "elevenlabs:v4": "ky"},  # Kyrgyz
    "ny": {"google:3.8-flash": "ny-MW", "google:3.8-flash-lite": "ny-MW", "google:3.1-flash": "ny-MW", "azure": "ny-MW", "elevenlabs": "ny", "elevenlabs:v4": "ny"},  # Chichewa
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
        "elevenlabs:v4",
        "google",
        "google:3.8-flash",
        "google:3.8-flash-lite",
        "google:3.1-flash",
        "smallest",
        "smallest:pro",
        "soniox",
        "xai",
    ):
        return provider in LANGUAGE_MAP[language]
    return True
