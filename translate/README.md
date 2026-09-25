# Soniox Compare — Speech-to-Speech Translation

Real-time speech translation comparison. Speak (mic or file) and see the original transcript next to the live translation for each provider; in speech-to-speech mode, hear the translation played back through your speakers.

**Part of [Soniox Compare](../README.md)** — see the root README for install, `./dev.sh`, ports, the streaming architecture, and the cross-app conventions (provider contract, `PROVIDER_MAP`, event builders, adding a provider, the `/compare/api` prefix, security headers). This file only covers what is specific to the `translate` app.

## Providers

Five runnable providers in `PROVIDER_MAP` (`main.py`), plus four declared greyed-out in `providers/unsupported.py`. Model IDs are the wire values, declared once as a module constant in each provider module.

| Provider     | Key            | Model(s)                          | `s2s`? |
| ------------ | -------------- | --------------------------------- | ------ |
| Soniox       | `soniox`       | `stt-rt-v5` + `tts-rt-v2`         | Yes |
| OpenAI       | `openai`       | `gpt-realtime-translate`          | Yes |
| Gemini       | `gemini`       | `gemini-3.5-live-translate-preview` | Yes |
| Speechmatics | `speechmatics` | `enhanced`                        | No (no TTS) |
| Azure        | `azure`        | `azure-speech-translation`        | Partial (only targets with a configured neural voice) |

**Greyed-out (can never run — no real-time translation upstream):** `deepgram` (`nova-3`), `assembly` (Universal-3.5 Pro), `cartesia` (`ink-2`), `elevenlabs` (Scribe v2 Realtime). Declared in `providers/unsupported.py` with the reason shown on hover; `compare_websocket` rejects them via the `PROVIDER_MAP` lookup.

## Endpoints

All under `/compare/api` except the operational `/.well-known/…` slugs.

| Method | Path | Purpose |
| ------ | ---- | ------- |
| `WS`  | `/compare/api/compare-websocket` | Live session. Query: `providers[]`, `mode` (`text`/`s2s`), `target_language`, `voice`, `language_hints[]`, `enable_speaker_diarization`, `enable_language_identification`, `enable_endpoint_detection` |
| `GET` | `/compare/api/providers-features` | Per-provider capability matrix (includes the greyed-out `unsupported.py` entries) |
| `GET` | `/compare/api/language-support`   | `{all_languages, providers}` — per-provider *source*-language codes (for greying out the source picker) plus their union, which is what the picker offers; a provider absent from `providers` is unconstrained |
| `GET` | `/compare/api/target-language-support` | Same shape for *target* languages (for greying out the target picker); a provider absent from `providers` can translate into nothing |
| `GET` | `/compare/api/providers/{name}/voices` | TTS voices the provider offers (s2s) |
| `GET` | `/.well-known/health/soniox-translation-compare`  | Health check → `ok` |
| `GET` | `/.well-known/version/soniox-translation-compare` | `VERSION` env var |

## App-specific behavior

- **Two modes** — selected via the WS `mode` query param (`Mode = Literal["text", "s2s"]` in `providers/config.py`):
  - `text` — translated text only; every runnable provider supports it.
  - `s2s` — the translation is also synthesized and streamed back as PCM. Supported by Soniox, OpenAI, Gemini; **partial** for Azure (only target languages with a configured neural voice); **unsupported** for Speechmatics (no TTS).
- **Target language & voices.** `target_language` (default `es`) and `voice` are per-session query params. `/target-language-support` lists each provider's target codes; `/providers/{name}/voices` lists selectable voices — OpenAI and Gemini expose no voice selection. `languages.py` holds two maps keyed by canonical ISO-639-1 code: `TARGET_LANGUAGE_MAP` (what each provider translates into) and `SOURCE_LANGUAGE_MAP` (the source code or locale each provider that is *told* the source expects — Azure and Speechmatics; the others auto-detect). Both support endpoints are built from these maps (`target_language_support()` / `source_language_support()`); provider classes hold no language data. Azure's per-target neural voices live in `providers/azure.py` (`_TARGET_VOICE`), since it is the only provider that picks one. Soniox is the one provider whose list is fetched live from the Soniox API and merged into both endpoints.
- **Source-language handling.** `language_hints` carries the source language. Only the providers that are *told* it appear in `/language-support`: Azure needs a full locale and otherwise identifies one of four candidates, transcribing anything else as the wrong language; Speechmatics rejects an unsupported source outright and is single-language per session; Soniox has its own list. Gemini and OpenAI auto-detect and never receive the hint, so they are absent and unconstrained.
- **Event builders** (`utils.py`): `make_part`, `data_event`, `audio_event`, `error_message`, `info_message`, `session_done_event`. Providers push these onto `host_queue`; audio events carry base64 PCM the UI plays gaplessly via Web Audio (s2s).
- **Session guards.** `MAX_SESSION_SECONDS = 5 min` and `MAX_STREAMED_AUDIO_BYTES = 12 MB` (decoded PCM) end a session with a message on every card.
- **Console script.** Unlike `stt`/`tts`, this app defines `[project.scripts] dev = "dev:main"`, so `uv run dev` starts the backend (`dev.py`).

## Environment keys

Add to `translate/.env` (copy from `.env.example`). A missing key disables only that provider, never startup.

| Variable | Provider |
| -------- | -------- |
| `SONIOX_API_KEY`       | Soniox |
| `OPENAI_API_KEY`       | OpenAI |
| `GOOGLE_API_KEY`       | Gemini (Gemini Developer API key — not a Vertex service account) |
| `SPEECHMATICS_API_KEY` | Speechmatics |
| `AZURE_API_KEY` + `AZURE_REGION` | Azure |

Also reads optional `VERSION` and `LOG_LEVEL`.

## License

[MIT](../LICENSE.txt)
