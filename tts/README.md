# Soniox Compare — Text-to-Speech

Text-to-speech comparison. Type text, pick a language, and hear each provider speak the exact same input — pronunciation and naturalness compared directly. Unlike the other two apps this one is **REST, not streaming**.

**Part of [Soniox Compare](../README.md)** — see the root README for install, `./dev.sh`, ports, architecture, and the cross-app conventions (provider contract, `PROVIDER_MAP`, adding a provider, the `/compare/api` prefix, security headers). This file only covers what is specific to the `tts` app.

- [Soniox](https://soniox.com/) — `tts-rt-v2`
- [OpenAI](https://platform.openai.com/docs/guides/text-to-speech) — `gpt-4o-mini-tts`
- [ElevenLabs](https://elevenlabs.io/) — `eleven_v3`
- [Google](https://cloud.google.com/text-to-speech) — `gemini-2.5-flash-tts`
- [Cartesia](https://cartesia.ai/) — `sonic-3.5`
- [Azure](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/text-to-speech) — `dragon-hd-omni`

Eight providers, registered in `PROVIDER_MAP` (`main.py`) as `"<name>" -> <name>.generate`. Each `providers/<name>.py` exposes `async def generate(text, language) -> AsyncIterator[bytes]` yielding mp3. Models/voices are hard-coded in each module.

| Provider         | Key            | Model / voice |
| ---------------- | -------------- | ------------- |
| Soniox           | `soniox`       | `tts-rt-v2` (voice `Daniel`) |
| Google           | `google`       | `gemini-2.5-flash-tts` |
| OpenAI           | `openai`       | `gpt-4o-mini-tts` (voice `marin`) |
| ElevenLabs       | `elevenlabs`   | `eleven_v3` |
| Cartesia         | `cartesia`     | `sonic-3.5` |
| Azure            | `azure`        | Dragon HD — voice `en-US-Ava:DragonHDOmniLatestNeural` |
| Smallest AI      | `smallest`     | `lightning_v3.1` (voice `magnus`) |
| Smallest AI Pro  | `smallest_pro` | `lightning_v3.1_pro` (voice `meher`) |

## Endpoints

All under `/compare/api` except the operational `/.well-known/…` slugs.

| Method | Path | Purpose |
| ------ | ---- | ------- |
| `GET` | `/compare/api/tts` | Synthesize one clip. Query: `text` (1–256 chars), `provider`, `language`. Returns `audio/mpeg` (mp3). 400 on unknown provider / unsupported language; 500 on upstream `ProviderError` |
| `GET` | `/compare/api/config` | Supported languages overall + per provider — the source of truth the frontend builds its selectors from |
| `GET` | `/.well-known/health/soniox-tts-compare`  | Health check → `ok` |
| `GET` | `/.well-known/version/soniox-tts-compare` | `VERSION` env var |

## App-specific behavior

- **REST, one call per clip.** The browser issues `GET /compare/api/tts?text=…&provider=…&language=…` per provider; the matching `generate()` makes one upstream HTTP call and streams back mp3. No WebSocket, no session state. Upstream errors are detected before the first byte and raised as `ProviderError`.
- **`MAX_TEXT_LENGTH = 256`** — enforced by the `text` query validator.
- **Per-provider language support** lives in `languages.py`. Languages are keyed by Soniox codes (ISO-639-1); `LANGUAGE_MAP` maps each to the code a provider expects. Soniox accepts every language; Cartesia / Azure / ElevenLabs / Smallest AI (both pools) only support languages with an explicit mapping; Google and OpenAI handle unmapped languages gracefully. `is_language_supported()` encodes these rules. Smallest AI's standard voice (`magnus`) covers English + 9 European languages; `smallest_pro`'s voice (`meher`) covers English + Hindi only, per Lightning v3.1 Pro's documented language set.
- **Sample texts.** Curated per-language sample texts (phone numbers, codes, emails, foreign names — the cases production TTS trips on) live in `frontend/src/lib/samples.ts`.
- **Dev cache header.** When `DEV=1` (set by `dev.sh`) audio responses are `no-store` so provider/prompt changes aren't hidden behind an hour-long browser cache; otherwise `private, max-age=3600`.

## Environment keys

Add to `tts/.env` (copy from `.env.example`). A missing key disables only that provider, never startup.

| Variable | Provider |
| -------- | -------- |
| `SONIOX_API_KEY`     | Soniox |
| `OPENAI_API_KEY`     | OpenAI |
| `ELEVENLABS_API_KEY` | ElevenLabs |
| `CARTESIA_API_KEY`   | Cartesia |
| `AZURE_API_KEY` + `AZURE_REGION` | Azure (`.env.example` defaults region to `eastus`) |
| `GOOGLE_CREDENTIALS_JSON_BASE64` | Google — **base64-encoded** service-account JSON (`base64 -i credentials-google.json`); falls back to `./credentials-google.json` (git-ignored) for local dev |

Also reads optional `VERSION`, `LOG_LEVEL`, and `DEV`.

## License

[MIT](../LICENSE.txt)
