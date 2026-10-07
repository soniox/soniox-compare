# Soniox Compare — Text-to-Speech

Text-to-speech comparison. Type text, pick a language, and hear each provider speak the exact same input — pronunciation and naturalness compared directly. Unlike the other two apps this one is **REST, not streaming**.

**Part of [Soniox Compare](../README.md)** — see the root README for install, `./dev.sh`, ports, architecture, and the cross-app conventions (provider contract, `PROVIDER_MAP`, adding a provider, the `/compare/api` prefix, security headers). This file only covers what is specific to the `tts` app.

- [Soniox](https://soniox.com/) — `tts-rt-v2`
- [OpenAI](https://platform.openai.com/docs/guides/text-to-speech) — `gpt-4o-mini-tts`
- [ElevenLabs](https://elevenlabs.io/) — `eleven_v4`, `eleven_v3`
- [Fish Audio](https://fish.audio/) — `s2.1-pro`
- [Inworld](https://inworld.ai/tts) — `inworld-tts-2`
- [xAI](https://docs.x.ai/docs/guides/text-to-speech) — voice `eve` (the endpoint takes no model)
- [Google](https://ai.google.dev/gemini-api/docs/speech-generation) — `gemini-2.5-flash-tts`, `gemini-3.8-flash-tts`, `gemini-3.8-flash-lite-tts`, `gemini-3.1-flash-tts-preview`
- [Cartesia](https://cartesia.ai/) — `sonic-3.6`
- [Deepgram](https://developers.deepgram.com/docs/tts-models) — `aura-2`
- [Azure](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/text-to-speech) — `dragon-hd-omni`
- [Smallest AI](https://smallest.ai/) — `lightning_v3.1_pro`

Eleven providers and their models, registered in `PROVIDER_MAP` (`main.py`). A key is `"<provider>"`, or `"<provider>:<variant>"` for a further model of the same provider — the backend treats keys as opaque, the frontend groups a provider's models by the part before the colon. Each `providers/<name>.py` exposes `async def generate(text, language) -> AsyncIterator[bytes]` yielding mp3; a module serving several models takes a `key=` argument with a default and keeps a `MODELS` table, and `main.py` registers the variants with `functools.partial`. Google is the exception: `google` (2.5) runs on Cloud Text-to-Speech with a service account, while the `google:*` keys run on the Gemini API with an API key, so `google.py` has a second function, `generate_gemini(text, language, key)`, with its own `GEMINI_MODELS` table. It streams `:streamGenerateContent?alt=sse`, which carries raw 24 kHz PCM (the Gemini API offers no compressed output for TTS), and encodes it on the fly to 128 kbps mp3 with `lameenc`, so every provider yields mp3.

| Provider    | Key            | Model / voice |
| -------- | ---- | ------------- |
| Soniox      | `soniox`       | `tts-rt-v2` (voice `Hazel`) |
| Google      | `google`       | `gemini-2.5-flash-tts` via Cloud Text-to-Speech (voice `Kore`) |
| Google      | `google:3.8-flash` | `gemini-3.8-flash-tts` via the Gemini API (voice `Kore`) |
| Google      | `google:3.8-flash-lite` | `gemini-3.8-flash-lite-tts` via the Gemini API (voice `Kore`) |
| Google      | `google:3.1-flash` | `gemini-3.1-flash-tts-preview` via the Gemini API (voice `Kore`) |
| OpenAI      | `openai`       | `gpt-4o-mini-tts` (voice `marin`) |
| ElevenLabs  | `elevenlabs:v4` | `eleven_v4` |
| ElevenLabs  | `elevenlabs`   | `eleven_v3` |
| Fish Audio  | `fish`         | `s2.1-pro` (voice `Sarah`) |
| Inworld     | `inworld`      | `inworld-tts-2` (voice `Ashley`) |
| xAI         | `xai`          | voice `eve` (no model parameter) |
| Cartesia    | `cartesia`     | `sonic-3.6` |
| Deepgram    | `deepgram`     | `aura-2` — the voice carries the language (e.g. `aura-2-agathe-fr`) |
| Azure       | `azure`        | Dragon HD — voice `en-US-Ava:DragonHDOmniLatestNeural` |
| Smallest AI | `smallest:pro` | `lightning_v3.1_pro` (voice `meher`) |

## Endpoints

All under `/compare/api` except the operational `/.well-known/…` slugs.

| Method | Path                                      | Purpose |
| ------ | ---- | ------- |
| `GET` | `/compare/api/tts`                        | Synthesize one clip. Query: `text` (1–256 chars), `provider`, `language`. Returns `audio/mpeg` (mp3). 400 on unknown provider / unsupported language; 500 on upstream `ProviderError` |
| `GET` | `/compare/api/config`                     | Supported languages overall + per provider — the source of truth the frontend builds its selectors from |
| `GET` | `/.well-known/health/soniox-tts-compare`  | Health check → `ok` |
| `GET` | `/.well-known/version/soniox-tts-compare` | `VERSION` env var |

## App-specific behavior

- **REST, one call per clip.** The browser issues `GET /compare/api/tts?text=…&provider=…&language=…` per provider; the matching `generate()` makes one upstream HTTP call and streams back mp3. No WebSocket, no session state. Upstream errors are detected before the first byte and raised as `ProviderError`.
- **`MAX_TEXT_LENGTH = 256`** — enforced by the `text` query validator.
- **Per-provider language support** lives in `languages.py`. Languages are keyed by ISO-639-1 codes and the key set is the **union of what the providers support**, not any one provider's list — so it includes languages Soniox does not offer. `LANGUAGE_MAP` maps each key to the code a provider expects, and a missing entry means that provider does not support the language. Soniox / Cartesia / Azure / ElevenLabs (both models) / Google (all four models) / Smallest AI (both models) / xAI need an explicit mapping; OpenAI, Fish Audio and Inworld take no language parameter — they infer it from the text — so they are listed for every language (`AUTO_DETECT_PROVIDERS`). `is_language_supported()` encodes these rules. Every entry was probed against the live API with the voice this app pins. Smallest routes some of its languages through an English or Hindi voice rather than a trained one.
- **Inworld streams NDJSON.** `inworld.py` posts to `/tts/v1/voice:stream`, which emits one JSON line per chunk; each line's `result.audioContent` is a base64 slice of one continuous MP3 stream, decoded and yielded as it arrives.
- **Gemini API streams SSE.** `generate_gemini` posts to `:streamGenerateContent?alt=sse`; each `data:` event's `inlineData` is a base64 slice of raw `audio/l16; rate=24000; channels=1` PCM for all three models (non-streaming 3.8 returns WAV, streaming does not). Each slice is fed through a `lameenc` encoder (24 kHz mono, 128 kbps) and the mp3 frames stream out as they are produced.
- **Sample texts.** Curated per-language sample texts (phone numbers, codes, emails, foreign names — the cases production TTS trips on) live in `frontend/src/lib/samples.ts`.
- **Dev cache header.** When `DEV=1` (set by `dev.sh`) audio responses are `no-store` so provider/prompt changes aren't hidden behind an hour-long browser cache; otherwise `private, max-age=3600`.

## Environment keys

Add to `tts/.env` (copy from `.env.example`). A missing key disables only that provider, never startup.

| Variable | Provider |
| -------- | -------- |
| `SONIOX_API_KEY`                 | Soniox |
| `OPENAI_API_KEY`                 | OpenAI |
| `ELEVENLABS_API_KEY`             | ElevenLabs |
| `FISH_API_KEY`                   | Fish Audio |
| `INWORLD_API_KEY`                | Inworld |
| `XAI_API_KEY`                    | xAI |
| `CARTESIA_API_KEY`               | Cartesia |
| `DEEPGRAM_API_KEY`               | Deepgram — the same key the stt app uses |
| `AZURE_API_KEY` + `AZURE_REGION` | Azure (`.env.example` defaults region to `eastus`) |
| `GOOGLE_CREDENTIALS_JSON_BASE64` | Google — **base64-encoded** service-account JSON (`base64 -i credentials-google.json`); falls back to `./credentials-google.json` (git-ignored) for local dev |
| `GOOGLE_API_KEY`                 | Google Gemini API models (`google:3.8-flash`, `google:3.8-flash-lite`, `google:3.1-flash`) — the same key the stt and translate apps use |

Also reads optional `VERSION`, `LOG_LEVEL`, and `DEV`.

## License

[MIT](../LICENSE.txt)
