# Soniox Compare — Speech-to-Text

Real-time speech-to-text comparison. Stream mic or file audio to many STT providers at once and watch their live transcripts side by side.

**Part of [Soniox Compare](../README.md)** — see the root README for install, `./dev.sh`, ports, the streaming architecture, and the cross-app conventions (provider contract, `PROVIDER_MAP`, event builders, adding a provider, the `/compare/api` prefix, security headers). This file only covers what is specific to the `stt` app.

## Providers

Eleven providers, registered in `PROVIDER_MAP` (`main.py`). Model IDs are the wire values from `config.py` — except Google, whose model id lives in its provider module because the Gemini Live session and the feature matrix must agree on it. Each provider module reports its model in `get_available_features()`.

| Provider     | Key           | Model (wire id)     |
| ------------ | ------------- | ------------------- |
| Soniox       | `soniox`      | `stt-rt-v5`         |
| OpenAI       | `openai`      | `gpt-4o-transcribe` |
| Deepgram     | `deepgram`    | `nova-3`            |
| AssemblyAI   | `assembly`    | `universal-3-5-pro` |
| Google       | `google`      | `gemini-3.5-transcribe-live` (Gemini Live API; model id owned by `providers/google.py`) |
| Azure        | `azure`       | `en-US-Conversation` (Speech SDK; region-based, no model id) |
| Speechmatics | `speechmatics`| `enhanced`          |
| Cartesia     | `cartesia`    | `ink-2`             |
| ElevenLabs   | `elevenlabs`  | `scribe_v2_realtime`|
| Meta         | `meta`        | `muse-voice-transcribe-1.0` |
| Smallest AI  | `smallest`    | `pulse`             |

## Endpoints

All under `/compare/api` except the operational `/.well-known/…` slugs.

| Method | Path | Purpose |
| ------ | ---- | ------- |
| `WS`  | `/compare/api/compare-websocket` | Live session. Query: `providers[]`, `language_hints[]`, `context`, `enable_speaker_diarization`, `enable_language_identification`, `enable_endpoint_detection` |
| `GET` | `/compare/api/providers-features` | Per-provider capability matrix (`get_available_features()`) |
| `GET` | `/compare/api/language-support`   | Per-provider supported input-language codes (Soniox omitted — it covers the whole rendered list) |
| `GET` | `/compare/api/soniox-model`       | Soniox `stt-rt-v5` model object; its `languages` drive the source-language list the UI renders |
| `GET` | `/.well-known/health/soniox-compare`  | Health check → `ok` |
| `GET` | `/.well-known/version/soniox-compare` | `VERSION` env var |

## App-specific behavior

- **Streaming transcripts.** Each provider emits normalized `{"type": "data", "provider": …, "parts": [make_part(...)]}` events (final + non-final tokens); the UI renders one live column per provider. Event builders live in `utils.py` (`make_part`, `error_message`, `info_message`).
- **Language hints & features.** The WS query flags (`language_hints`, `context`, diarization, language identification, endpoint detection) are passed to every provider as `ProviderParams`. Each provider advertises which it actually supports via `get_available_features()` (served at `/providers-features`) — e.g. Soniox supports the full set; OpenAI has no language hints/diarization; Cartesia (`ink-2`) is English-only; Speechmatics is single-language (no in-session auto-detect); Azure language identification is limited to a candidate set (≤10); Google turns `context` into `custom_vocabulary` biasing phrases and is pinned to the model's `VERBATIM` mode, since `SMART` would rewrite the transcript (dropping filler words, reformatting lists) and make the side-by-side comparison unfair; Smallest AI (Pulse) has no single universal auto-detect mode, only regional aggregators (`north_indic`, `multi-asian`, `multi-south-indic`), so a single language hint is used instead; it also turns `context` into `keywords` boosting terms and enables punctuation formatting + inverse text normalization (`format`, `itn_normalize`) for parity with the other providers' comparable formatting flags.
- **Source-language list = Soniox's model.** The selectable input languages come from Soniox's `stt-rt-v5` model (`/soniox-model`); `/language-support` then marks which other providers cover each of those languages. Per-provider input-language support lives in `languages.py` (`LANGUAGE_MAP`, keyed by Soniox code → the code each provider's API expects).
- **Resampling.** `providers/audio.py` holds a `soxr` streaming resampler for providers that need a fixed input sample rate.
- **Session guards.** `MAX_SESSION_SECONDS = 5 min` and `MAX_STREAMED_AUDIO_BYTES = 12 MB` (decoded PCM) end a session with a message on every card.

## Environment keys

Add to `stt/.env` (copy from `.env.example`). A missing key disables only that provider, never startup.

| Variable | Provider |
| -------- | -------- |
| `SONIOX_API_KEY`        | Soniox |
| `OPENAI_API_KEY`        | OpenAI |
| `DEEPGRAM_API_KEY`      | Deepgram |
| `ASSEMBLY_API_KEY`      | AssemblyAI |
| `SPEECHMATICS_API_KEY`  | Speechmatics |
| `AZURE_API_KEY` + `AZURE_REGION` | Azure |
| `CARTESIA_API_KEY`      | Cartesia |
| `ELEVENLABS_API_KEY`    | ElevenLabs |
| `SMALLEST_API_KEY`      | Smallest AI |
| `GOOGLE_API_KEY`        | Google — a Gemini Developer API key (Google AI Studio), not a Vertex service account |
| `META_API_KEY`          | Meta |

Also reads optional `VERSION` and `LOG_LEVEL`.

## License

[MIT](../LICENSE.txt)
