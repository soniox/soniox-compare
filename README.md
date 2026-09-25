# Soniox Compare

Side-by-side tools for comparing [Soniox](https://soniox.com/) against other speech-AI providers, source included so anyone can run the comparisons and check the results. Live at https://soniox.com/compare/.

Three independent web apps — each a FastAPI backend + React/Vite frontend with its own `uv` project and `frontend/`. They share conventions, not code; there's no shared package.

| App                                 | What it does                                                     | Transport | Details                       |
| ----------------------------------- | ---------------------------------------------------------------- | --------- | ----------------------------- |
| [`stt/`](stt/README.md)             | Stream mic/audio to many STT providers, compare live transcripts | WebSocket | [readme](stt/README.md)       |
| [`tts/`](tts/README.md)             | Type text, hear each provider speak it                           | REST      | [readme](tts/README.md)       |
| [`translate/`](translate/README.md) | Speak → see the original + translation, optionally hear it       | WebSocket | [readme](translate/README.md) |

Each app's README lists its providers, models, and endpoints.

## Quick start

Needs [`uv`](https://github.com/astral-sh/uv), Node + [`yarn`](https://yarnpkg.com/), and provider API keys (`dev.sh` also uses `lsof`/`pgrep`).

```bash
for app in stt tts translate; do cp "$app/.env.example" "$app/.env"; done  # then fill in keys
./dev.sh   # installs deps, builds every frontend, starts all six processes
```

A missing key only disables that one provider. Each app runs on a **UI port** (Vite, hot-reload — use this) and an **API port** (backend, which also serves a built UI snapshot):

| App       | UI             | API            |
| --------- | -------------- | -------------- |
| stt       | localhost:5173 | localhost:8000 |
| tts       | localhost:5174 | localhost:8001 |
| translate | localhost:5175 | localhost:8002 |

Override any port via env var, e.g. `TTS_UI_PORT=6000 ./dev.sh`.

### Running one app

```bash
cd stt                                             # or tts / translate
cp .env.example .env                               # add keys
cd frontend && yarn install && yarn build && cd .. # build the UI first (see note)
uv sync && uv run fastapi dev                      # backend on :8000
```

While iterating on the frontend, `yarn dev` in `frontend/` hot-reloads and proxies `/compare/api` to the backend.

> The backend mounts `frontend/dist` at `/`, so an unbuilt frontend makes the app 404 its own assets. Build before serving from the API port — `dev.sh` does this every run.

## How it works

Streaming apps (`stt`, `translate`): the browser sends PCM16 / 16 kHz over a WebSocket to `/compare/api/compare-websocket`. `main.py` fans that single stream out to one provider instance per selected provider; each runs its own upstream session and pushes normalized events onto a `host_queue`. `main.py` stamps each event with its provider name and forwards uniform JSON, which the UI renders as one column per provider. In `translate` s2s mode the translated audio streams back and plays gaplessly via Web Audio. Sessions are capped at 5 min and 12 MB of decoded PCM.

`tts` is REST instead: the browser calls `GET /compare/api/tts?text=…&provider=…&language=…`, and the provider's `generate()` makes one upstream call and streams back `audio/mpeg`. No sockets, no session state.

## Conventions

Shared by all three apps:

- **Provider module** — `providers/<name>.py`, one per provider. Streaming apps define a `<Name>Provider(BaseProvider)` with `name = "<name>"` implementing `connect` / `disconnect` / `send` / `send_end` / `get_available_features`, emitting via the `utils.py` builders onto `self.host_queue`. `tts` instead exposes a module-level `async def generate(text, language) -> AsyncIterator[bytes]` yielding mp3, built on `_require_env` / `_stream_post` from `providers/base.py`.
- **Registry** — `PROVIDER_MAP`, a plain dict in `main.py` (`"<name>" -> Provider`, or `-> generate` for tts). No `APIRouter`; each route hard-codes its full path.
- **Provider keys** — `"<provider>"`, or `"<provider>:<variant>"` for a further model of the same provider (`smallest:pro`). The backend treats keys as opaque strings; only the frontend splits on the colon, to share a provider's icon and display name across its models while price, model label and language support stay per key. In tts one module serves several models via a `MODELS` table and a `key=` argument, registered with `functools.partial`.
- **Routes** — everything lives under `/compare/api/…`, except `/.well-known/…` (health, version) and the UI at `/`. The `security_headers` middleware keys off that prefix, sets `nosniff` + `no-referrer` and long cache headers for `/assets/`, and there's no CORS.
- **Languages** — `languages.py` holds `LANGUAGE_MAP`, keyed by Soniox's canonical codes, mapping each to the code a provider's API expects.

**Adding a provider:** write `providers/<name>.py`, add it to `PROVIDER_MAP`, wire its credentials (`config.py` for stt/translate, `os.getenv` for tts) and env var into `.env.example`. The frontend reads the roster from the backend, so it needs no change.

## Environment variables

A key is only needed for providers you run. Google TTS still uses a service-account JSON rather than a simple key.

| Variable                         | stt | tts | translate | Provider                 |
| -------------------------------- | :-: | :-: | :-------: | ------------------------ |
| `SONIOX_API_KEY`                 |  ●  |  ●  |     ●     | Soniox                   |
| `OPENAI_API_KEY`                 |  ●  |  ●  |     ●     | OpenAI                   |
| `ELEVENLABS_API_KEY`             |  ●  |  ●  |           | ElevenLabs               |
| `FISH_API_KEY`                   |     |  ●  |           | Fish Audio               |
| `INWORLD_API_KEY`                |  ●  |  ●  |           | Inworld                  |
| `XAI_API_KEY`                    |  ●  |  ●  |           | xAI                      |
| `CARTESIA_API_KEY`               |  ●  |  ●  |           | Cartesia                 |
| `DEEPGRAM_API_KEY`               |  ●  |     |           | Deepgram                 |
| `ASSEMBLY_API_KEY`               |  ●  |     |           | AssemblyAI               |
| `SPEECHMATICS_API_KEY`           |  ●  |     |     ●     | Speechmatics             |
| `AZURE_API_KEY` + `AZURE_REGION` |  ●  |  ●  |     ●     | Azure                    |
| `SMALLEST_API_KEY`               |  ●  |  ●  |           | Smallest AI              |
| `GOOGLE_API_KEY`                 |  ●  |     |     ●     | Gemini (STT + translate) |
| `GOOGLE_CREDENTIALS_JSON_BASE64` |     |  ●  |           | Google TTS               |

### Add a new provider

**Streaming app (`stt` or `translate`):**

1. Create the module at `<app>/providers/<name>.py` with `class <Name>Provider(BaseProvider)` and `name = "<name>"`.
2. Implement `connect`, `disconnect`, `send`, `send_end`, and `@staticmethod get_available_features()`; emit results via the `utils.py` event builders onto `self.host_queue`.
3. Register it in `<app>/main.py`: import the class and add `"<name>": <Name>Provider` to `PROVIDER_MAP`.
4. Add credentials + upstream config in `<app>/config.py` — `stt`: add a factory to `_SERVICE_CONFIG_FACTORIES`; `translate`: add the key to `_CRED_ENV` and a factory to `_SERVICE_CONFIG_FACTORIES`.
5. Add the env var to `<app>/.env.example`.

**REST app (`tts`):**

1. Create the module at `tts/providers/<name>.py` exposing `async def generate(text, language) -> AsyncIterator[bytes]` (use `_require_env` / `_stream_post` from `providers/base.py`).
2. Register it in `tts/main.py`: import the module and add `"<name>": <name>.generate` to `PROVIDER_MAP`.
3. Add per-provider language codes to `LANGUAGE_MAP` in `tts/languages.py` if the provider needs explicit mappings.
4. Add the env var to `tts/.env.example`.

The frontend reads per-provider languages and capabilities from the backend (`/compare/api/providers-features` for streaming apps, `/compare/api/config` for `tts`), but the roster itself is a hardcoded list in the frontend (`PROVIDERS` in tts, `ALL_PROVIDERS_LIST` in stt/translate) — a new provider or model has to be added there too, along with its display name, icon and pricing record.

## Per-app details

### `stt/` — real-time speech-to-text

- **Providers (13):** `soniox`, `openai`, `deepgram`, `assembly`, `google`, `azure`, `speechmatics`, `cartesia`, `elevenlabs`, `meta`, `smallest`, `xai`, `inworld`.
- **Notable models:** Soniox `stt-rt-v5`, OpenAI `gpt-4o-transcribe`, Deepgram `nova-3`, AssemblyAI `universal-3-5-pro`, Google `gemini-3.5-transcribe-live`, Cartesia `ink-2`, ElevenLabs `scribe_v2_realtime`, Speechmatics `enhanced`.
- **Endpoints:** `WS /compare/api/compare-websocket`, `GET /compare/api/providers-features`, `GET /compare/api/language-support`, `GET /compare/api/soniox-model`, `GET /.well-known/health/soniox-compare`, `GET /.well-known/version/soniox-compare`.
- **App-specific:** per-provider input-language maps live in `stt/transcription_languages/*.json`; `providers/audio.py` holds a `soxr` streaming resampler for providers needing a fixed sample rate.

### `tts/` — text-to-speech (REST)

- **Providers (10):** `soniox`, `google`, `openai`, `elevenlabs`, `fish`, `inworld`, `xai`, `cartesia`, `azure`, `smallest:pro`.
- **Notable models:** Soniox `tts-rt-v2`, OpenAI `gpt-4o-mini-tts`, ElevenLabs `eleven_v3`, Google `gemini-2.5-flash-tts`, Fish Audio `s2.1-pro`, Inworld `inworld-tts-2`, xAI `tts-v1`, Cartesia `sonic-3.6`, Azure Dragon HD (`en-US-Ava:DragonHDOmniLatestNeural`).
- **Endpoints:** `GET /compare/api/tts` (query `text` ≤ 256 chars, `provider`, `language`; returns `audio/mpeg`), `GET /compare/api/config`, `GET /.well-known/health/soniox-tts-compare`, `GET /.well-known/version/soniox-tts-compare`.
- **App-specific:** `MAX_TEXT_LENGTH = 256`; `languages.py` maps Soniox language codes to each provider's codes; curated per-language sample texts live in `frontend/src/lib/samples.ts`.

### `translate/` — real-time speech-to-speech translation

- **Providers (5 runnable):** `soniox`, `openai`, `gemini`, `speechmatics`, `azure`. Four more (`deepgram`, `assembly`, `cartesia`, `elevenlabs`) are declared greyed-out in `providers/unsupported.py`.
- **Two modes** — selected via the WebSocket `mode` query param (`Mode = Literal["text", "s2s"]` in `providers/config.py`):
  - `text` — translated text only. Every runnable provider supports it.
  - `s2s` — speech-to-speech: the translation is also synthesized and streamed back as PCM. Supported by Soniox, OpenAI, Gemini; **partial** for Azure (only targets with a configured neural voice); **unsupported** for Speechmatics (no TTS).
- **Notable models:** Soniox `stt-rt-v5` + `tts-rt-v2`, OpenAI `gpt-realtime-translate`, Gemini `gemini-3.5-live-translate-preview`, Speechmatics `enhanced`, Azure `azure-speech-translation`.
- **Endpoints:** `WS /compare/api/compare-websocket`, `GET /compare/api/providers-features`, `GET /compare/api/language-support`, `GET /compare/api/target-language-support`, `GET /compare/api/providers/{name}/voices`, `GET /compare/api/soniox-model`, `GET /.well-known/health/soniox-translation-compare`, `GET /.well-known/version/soniox-translation-compare`.
- **App-specific:** `uv run dev` also works here (`[project.scripts] dev = "dev:main"`), unlike `stt`/`tts` which have no console script.

### Environment variables

Keys are only required for the providers you actually run; a missing key disables just that provider, never startup. Google STT and translate both run on the Gemini Developer API and take a plain API key; only Google TTS still needs a service-account JSON.

| Variable                         | stt | tts | translate | Provider                |
| -------------------------------- | :-: | :-: | :-------: | ----------------------- |
| `SONIOX_API_KEY`                 |  ●  |  ●  |     ●     | Soniox                  |
| `OPENAI_API_KEY`                 |  ●  |  ●  |     ●     | OpenAI                  |
| `ELEVENLABS_API_KEY`             |  ●  |  ●  |           | ElevenLabs              |
| `FISH_API_KEY`                   |     |  ●  |           | Fish Audio              |
| `INWORLD_API_KEY`                |  ●  |  ●  |           | Inworld                 |
| `XAI_API_KEY`                    |  ●  |  ●  |           | xAI                     |
| `CARTESIA_API_KEY`               |  ●  |  ●  |           | Cartesia                |
| `DEEPGRAM_API_KEY`               |  ●  |     |           | Deepgram                |
| `ASSEMBLY_API_KEY`               |  ●  |     |           | AssemblyAI              |
| `SPEECHMATICS_API_KEY`           |  ●  |     |     ●     | Speechmatics            |
| `AZURE_API_KEY` + `AZURE_REGION` |  ●  |  ●  |     ●     | Azure                   |
| `GOOGLE_API_KEY`                 |  ●  |     |     ●     | Gemini (STT, translate) |
| `GOOGLE_CREDENTIALS_JSON_BASE64` |     |  ●  |           | Google (TTS, base64)    |

`main.py` in each app also reads optional `VERSION` (served at `/.well-known/version/…`) and `LOG_LEVEL`.

## Deployment

Each app deploys as its own service on its own domain from its `Dockerfile`: `yarn build` compiles the frontend into `frontend/dist`, which the backend serves at `/`. Health and version are at `/.well-known/health/<slug>` and `/.well-known/version/<slug>` — slugs `soniox-compare` (stt), `soniox-tts-compare` (tts), `soniox-translation-compare` (translate).

## License

[MIT](LICENSE.txt)
