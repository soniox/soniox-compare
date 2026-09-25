"""Per-provider language support for translation.

Two maps, because two different sets of providers are involved: every provider
has targets, but only the two that are *told* the source language constrain it
(Azure, Speechmatics). Which providers appear in a map is itself the data.
They are not mirrors of each other: Speechmatics hears twelve languages it
cannot translate into (`fa` among them), and Azure wants a full locale as a
source (`fa-IR`) against a bare code as a target (`fa`).

A few languages sit on one side only: `as`, `ceb` are targets nobody accepts as
a source, `bho`, `wuu` are sources nobody targets, `ka` is a Gemini target and
an Azure source, and `be` is a target Azure translates but has no voice for.

Keyed by canonical ISO-639-1 code — the union of what the providers support, not
Soniox's list. Each provider entry maps that code to the target code its
API expects (identity for most; e.g. Speechmatics Mandarin = "cmn", Azure
Norwegian = "nb"). A missing entry means the provider cannot translate into that
language. Soniox is omitted: it takes its target list live from the Soniox API.

OpenAI is the one provider whose input and output lists differ sharply — the
realtime translation model accepts many input languages but only emits these
13, so a target outside them cannot be produced at all.

Gemini's 80 were verified one session at a time against the live model: each
target was asked to translate the same English clip and the returned transcript
was checked to be in that language. `mi` and `wuu` are rejected outright, and
`bho` is absent because it is accepted but answers in standard Hindi.

Azure's 77 were verified the same way. `ka` is absent because Azure returns
Bulgarian transliterated into Georgian script rather than Georgian. `be` is the
one target it translates but cannot speak, so s2s stays unavailable there.
"""

TARGET_LANGUAGE_MAP = {
    "af": {"azure": "af", "gemini": "af"},
    "am": {"azure": "am", "gemini": "am"},
    "ar": {"azure": "ar", "gemini": "ar"},
    "as": {"azure": "as", "gemini": "as"},
    "az": {"azure": "az", "gemini": "az"},
    "be": {"azure": "be", "gemini": "be"},
    "bg": {"azure": "bg", "gemini": "bg", "speechmatics": "bg"},
    "bn": {"azure": "bn", "gemini": "bn"},
    "bs": {"azure": "bs", "gemini": "bs"},
    "ca": {"azure": "ca", "gemini": "ca", "speechmatics": "ca"},
    "ceb": {"gemini": "ceb"},
    "cs": {"azure": "cs", "gemini": "cs", "speechmatics": "cs"},
    "cy": {"azure": "cy", "gemini": "cy"},
    "da": {"azure": "da", "gemini": "da", "speechmatics": "da"},
    "de": {"openai": "de", "azure": "de", "gemini": "de", "speechmatics": "de"},
    "el": {"azure": "el", "gemini": "el", "speechmatics": "el"},
    "en": {"openai": "en", "azure": "en", "gemini": "en", "speechmatics": "en"},
    "es": {"openai": "es", "azure": "es", "gemini": "es", "speechmatics": "es"},
    "et": {"azure": "et", "gemini": "et", "speechmatics": "et"},
    "eu": {"azure": "eu", "gemini": "eu"},
    "fa": {"azure": "fa", "gemini": "fa"},
    "fi": {"azure": "fi", "gemini": "fi", "speechmatics": "fi"},
    "fr": {"openai": "fr", "azure": "fr", "gemini": "fr", "speechmatics": "fr"},
    "ga": {"azure": "ga", "gemini": "ga"},
    "gl": {"azure": "gl", "gemini": "gl", "speechmatics": "gl"},
    "gu": {"azure": "gu", "gemini": "gu"},
    "he": {"azure": "he", "gemini": "he"},
    "hi": {"openai": "hi", "azure": "hi", "gemini": "hi", "speechmatics": "hi"},
    "hr": {"azure": "hr", "gemini": "hr", "speechmatics": "hr"},
    "hu": {"azure": "hu", "gemini": "hu", "speechmatics": "hu"},
    "hy": {"azure": "hy", "gemini": "hy"},
    "id": {"openai": "id", "azure": "id", "gemini": "id", "speechmatics": "id"},
    "is": {"azure": "is", "gemini": "is"},
    "it": {"openai": "it", "azure": "it", "gemini": "it", "speechmatics": "it"},
    "ja": {"openai": "ja", "azure": "ja", "gemini": "ja", "speechmatics": "ja"},
    "jv": {"gemini": "jv"},
    "ka": {"gemini": "ka"},
    "kk": {"azure": "kk", "gemini": "kk"},
    "km": {"azure": "km", "gemini": "km"},
    "kn": {"azure": "kn", "gemini": "kn"},
    "ko": {"openai": "ko", "azure": "ko", "gemini": "ko", "speechmatics": "ko"},
    "lo": {"azure": "lo", "gemini": "lo"},
    "lt": {"azure": "lt", "gemini": "lt", "speechmatics": "lt"},
    "lv": {"azure": "lv", "gemini": "lv", "speechmatics": "lv"},
    "mk": {"azure": "mk", "gemini": "mk"},
    "ml": {"azure": "ml", "gemini": "ml"},
    "mn": {"azure": "mn-Cyrl", "gemini": "mn"},
    "mr": {"azure": "mr", "gemini": "mr"},
    "ms": {"azure": "ms", "gemini": "ms", "speechmatics": "ms"},
    "mt": {"azure": "mt", "gemini": "mt"},
    "my": {"azure": "my", "gemini": "my"},
    "ne": {"azure": "ne", "gemini": "ne"},
    "nl": {"azure": "nl", "gemini": "nl", "speechmatics": "nl"},
    "no": {"azure": "nb", "gemini": "no", "speechmatics": "no"},
    "pa": {"azure": "pa", "gemini": "pa"},
    "pl": {"azure": "pl", "gemini": "pl", "speechmatics": "pl"},
    "ps": {"azure": "ps", "gemini": "ps"},
    "pt": {"openai": "pt", "azure": "pt", "gemini": "pt", "speechmatics": "pt"},
    "ro": {"azure": "ro", "gemini": "ro", "speechmatics": "ro"},
    "ru": {"openai": "ru", "azure": "ru", "gemini": "ru", "speechmatics": "ru"},
    "si": {"azure": "si", "gemini": "si"},
    "sk": {"azure": "sk", "gemini": "sk", "speechmatics": "sk"},
    "sl": {"azure": "sl", "gemini": "sl", "speechmatics": "sl"},
    "so": {"azure": "so", "gemini": "so"},
    "sq": {"azure": "sq", "gemini": "sq"},
    "sr": {"azure": "sr-Cyrl", "gemini": "sr"},
    "sv": {"azure": "sv", "gemini": "sv", "speechmatics": "sv"},
    "sw": {"azure": "sw", "gemini": "sw"},
    "ta": {"azure": "ta", "gemini": "ta"},
    "te": {"azure": "te", "gemini": "te"},
    "th": {"azure": "th", "gemini": "th"},
    "tl": {"azure": "fil", "gemini": "tl"},
    "tr": {"azure": "tr", "gemini": "tr", "speechmatics": "tr"},
    "uk": {"azure": "uk", "gemini": "uk", "speechmatics": "uk"},
    "ur": {"azure": "ur", "gemini": "ur"},
    "uz": {"azure": "uz", "gemini": "uz"},
    "vi": {"openai": "vi", "azure": "vi", "gemini": "vi", "speechmatics": "vi"},
    "yue": {"azure": "yue", "gemini": "yue"},
    "zh": {"openai": "zh", "azure": "zh-Hans", "gemini": "zh", "speechmatics": "cmn"},
    "zu": {"azure": "zu", "gemini": "zu"},
}


# The providers whose targets this file owns. Soniox is absent because it takes
# its target list live from its own API, so an unknown target is its call.
_TARGET_PROVIDERS = {p for entry in TARGET_LANGUAGE_MAP.values() for p in entry}


def get_target_language(language: str, provider: str) -> str | None:
    """The target code `provider` wants for `language`, or None if unsupported."""
    return TARGET_LANGUAGE_MAP.get(language, {}).get(provider)


def is_language_supported(language: str, provider: str) -> bool:
    return provider in TARGET_LANGUAGE_MAP.get(language, {})


def unsupported_target(provider: str, target: str) -> str | None:
    """`target` if this provider cannot translate into it, else None.

    Without this the providers fall back to sending the raw code, and Azure
    answers with the untranslated source rather than an error.
    """
    if provider not in _TARGET_PROVIDERS:
        return None
    if is_language_supported(target, provider):
        return None
    return target


def target_language_support() -> dict[str, list[str]]:
    """Per-provider target-language codes, for greying out the target picker.
    Soniox is absent here; the endpoint merges its live list."""
    support: dict[str, list[str]] = {}
    for code, providers in TARGET_LANGUAGE_MAP.items():
        for provider in providers:
            support.setdefault(provider, []).append(code)
    return {p: sorted(codes) for p, codes in support.items()}


# Per-provider SOURCE-language support, keyed the same way. Azure needs a full
# locale for `speech_recognition_language`; without one it falls back to a
# four-candidate auto-detect and transcribes the audio as the wrong language.
# Speechmatics rejects an unsupported source outright. Gemini and OpenAI are
# absent because they auto-detect and never receive the hint.
SOURCE_LANGUAGE_MAP = {
    "af": {"azure": "af-ZA"},
    "am": {"azure": "am-ET"},
    "ar": {"azure": "ar-EG", "speechmatics": "ar"},
    "az": {"azure": "az-AZ"},
    "be": {"speechmatics": "be"},
    "bg": {"azure": "bg-BG", "speechmatics": "bg"},
    "bho": {"azure": "bho-IN"},
    "bn": {"azure": "bn-IN", "speechmatics": "bn"},
    "bs": {"azure": "bs-BA"},
    "ca": {"azure": "ca-ES", "speechmatics": "ca"},
    "cs": {"azure": "cs-CZ", "speechmatics": "cs"},
    "cy": {"azure": "cy-GB", "speechmatics": "cy"},
    "da": {"azure": "da-DK", "speechmatics": "da"},
    "de": {"azure": "de-DE", "speechmatics": "de"},
    "el": {"azure": "el-GR", "speechmatics": "el"},
    "en": {"azure": "en-US", "speechmatics": "en"},
    "es": {"azure": "es-ES", "speechmatics": "es"},
    "et": {"azure": "et-EE", "speechmatics": "et"},
    "eu": {"azure": "eu-ES", "speechmatics": "eu"},
    "fa": {"azure": "fa-IR", "speechmatics": "fa"},
    "fi": {"azure": "fi-FI", "speechmatics": "fi"},
    "fr": {"azure": "fr-FR", "speechmatics": "fr"},
    "ga": {"azure": "ga-IE"},
    "gl": {"azure": "gl-ES", "speechmatics": "gl"},
    "gu": {"azure": "gu-IN"},
    "he": {"azure": "he-IL", "speechmatics": "he"},
    "hi": {"azure": "hi-IN", "speechmatics": "hi"},
    "hr": {"azure": "hr-HR", "speechmatics": "hr"},
    "hu": {"azure": "hu-HU", "speechmatics": "hu"},
    "hy": {"azure": "hy-AM"},
    "id": {"azure": "id-ID", "speechmatics": "id"},
    "is": {"azure": "is-IS"},
    "it": {"azure": "it-IT", "speechmatics": "it"},
    "ja": {"azure": "ja-JP", "speechmatics": "ja"},
    "jv": {"azure": "jv-ID"},
    "ka": {"azure": "ka-GE"},
    "kk": {"azure": "kk-KZ"},
    "km": {"azure": "km-KH"},
    "kn": {"azure": "kn-IN"},
    "ko": {"azure": "ko-KR", "speechmatics": "ko"},
    "lo": {"azure": "lo-LA"},
    "lt": {"azure": "lt-LT", "speechmatics": "lt"},
    "lv": {"azure": "lv-LV", "speechmatics": "lv"},
    "mk": {"azure": "mk-MK"},
    "ml": {"azure": "ml-IN"},
    "mn": {"azure": "mn-MN"},
    "mr": {"azure": "mr-IN", "speechmatics": "mr"},
    "ms": {"azure": "ms-MY", "speechmatics": "ms"},
    "mt": {"azure": "mt-MT"},
    "my": {"azure": "my-MM"},
    "ne": {"azure": "ne-NP"},
    "nl": {"azure": "nl-NL", "speechmatics": "nl"},
    "no": {"azure": "nb-NO", "speechmatics": "no"},
    "pa": {"azure": "pa-IN"},
    "pl": {"azure": "pl-PL", "speechmatics": "pl"},
    "ps": {"azure": "ps-AF"},
    "pt": {"azure": "pt-PT", "speechmatics": "pt"},
    "ro": {"azure": "ro-RO", "speechmatics": "ro"},
    "ru": {"azure": "ru-RU", "speechmatics": "ru"},
    "si": {"azure": "si-LK"},
    "sk": {"azure": "sk-SK", "speechmatics": "sk"},
    "sl": {"azure": "sl-SI", "speechmatics": "sl"},
    "so": {"azure": "so-SO"},
    "sq": {"azure": "sq-AL"},
    "sr": {"azure": "sr-RS"},
    "sv": {"azure": "sv-SE", "speechmatics": "sv"},
    "sw": {"azure": "sw-KE", "speechmatics": "sw"},
    "ta": {"azure": "ta-IN", "speechmatics": "ta"},
    "te": {"azure": "te-IN"},
    "th": {"azure": "th-TH", "speechmatics": "th"},
    "tl": {"azure": "fil-PH"},
    "tr": {"azure": "tr-TR", "speechmatics": "tr"},
    "uk": {"azure": "uk-UA", "speechmatics": "uk"},
    "ur": {"azure": "ur-IN", "speechmatics": "ur"},
    "uz": {"azure": "uz-UZ"},
    "vi": {"azure": "vi-VN", "speechmatics": "vi"},
    "wuu": {"azure": "wuu-CN"},
    "yue": {"azure": "yue-CN"},
    "zh": {"azure": "zh-CN", "speechmatics": "cmn"},
    "zu": {"azure": "zu-ZA"},
}


def get_source_language(language: str, provider: str) -> str | None:
    """The source code `provider` wants for `language`, or None if unsupported."""
    return SOURCE_LANGUAGE_MAP.get(language, {}).get(provider)


def unsupported_source(provider: str, language_hints: list[str]) -> str | None:
    """The first hint this provider cannot take as a source, else None.

    A provider absent from SOURCE_LANGUAGE_MAP auto-detects and is never told
    the source, so nothing to check. Azure is the reason this exists: an
    unmapped hint leaves `speech_recognition_language` unset and it identifies
    one of four candidates instead, transcribing the audio as the wrong
    language without any error.
    """
    if not language_hints:
        return None
    supported = source_language_support().get(provider)
    if supported is None:
        return None
    for hint in language_hints:
        if hint not in supported:
            return hint
    return None


def source_language_support() -> dict[str, list[str]]:
    """Per-provider source-language codes, for greying out the source picker.
    A provider absent from this map places no restriction on the source."""
    support: dict[str, list[str]] = {}
    for code, providers in SOURCE_LANGUAGE_MAP.items():
        for provider in providers:
            support.setdefault(provider, []).append(code)
    return {p: sorted(codes) for p, codes in support.items()}
