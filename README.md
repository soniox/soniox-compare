# Soniox Compare

Side-by-side tools for comparing [Soniox](https://soniox.com/) against other speech-AI providers, source included so anyone can run the comparisons and check the results. Live at https://soniox.com/compare/.

Three independent web apps — each a FastAPI backend + React/Vite frontend with its own `uv` project and `frontend/`. They share conventions, not code; there's no shared package.

| App | What it does | Transport | Details |
| --- | --- | --- | --- |
| [`stt/`](stt/README.md) | Stream mic/audio to many STT providers, compare live transcripts | WebSocket | [readme](stt/README.md) |
| [`tts/`](tts/README.md) | Type text, hear each provider speak it | REST | [readme](tts/README.md) |
| [`translate/`](translate/README.md) | Speak → see the original + translation, optionally hear it | WebSocket | [readme](translate/README.md) |

Each app's README lists its providers, models, and endpoints.

## Quick start

Needs [`uv`](https://github.com/astral-sh/uv), Node + [`yarn`](https://yarnpkg.com/), and provider API keys (`dev.sh` also uses `lsof`/`pgrep`).

```bash
for app in stt tts translate; do cp "$app/.env.example" "$app/.env"; done  # then fill in keys
./dev.sh   # installs deps, builds every frontend, starts all six processes
```

A missing key only disables that one provider. Each app runs on a **UI port** (Vite, hot-reload — use this) and an **API port** (backend, which also serves a built UI snapshot):

| App | UI | API |
| --- | --- | --- |
| stt | localhost:5173 | localhost:8000 |
| tts | localhost:5174 | localhost:8001 |
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
- **Routes** — everything lives under `/compare/api/…`, except `/.well-known/…` (health, version) and the UI at `/`. The `security_headers` middleware keys off that prefix, sets `nosniff` + `no-referrer` and long cache headers for `/assets/`, and there's no CORS.
- **Languages** — `languages.py` holds `LANGUAGE_MAP`, keyed by Soniox's canonical codes, mapping each to the code a provider's API expects.

**Adding a provider:** write `providers/<name>.py`, add it to `PROVIDER_MAP`, wire its credentials (`config.py` for stt/translate, `os.getenv` for tts) and env var into `.env.example`. The frontend reads the roster from the backend, so it needs no change.

## Environment variables

A key is only needed for providers you run. Google TTS use a service-account JSON rather than a simple key.

| Variable | stt | tts | translate | Provider |
| --- | :-: | :-: | :-: | --- |
| `SONIOX_API_KEY` | ● | ● | ● | Soniox |
| `OPENAI_API_KEY` | ● | ● | ● | OpenAI |
| `ELEVENLABS_API_KEY` | ● | ● | | ElevenLabs |
| `CARTESIA_API_KEY` | ● | ● | | Cartesia |
| `DEEPGRAM_API_KEY` | ● | | | Deepgram |
| `ASSEMBLY_API_KEY` | ● | | | AssemblyAI |
| `SPEECHMATICS_API_KEY` | ● | | ● | Speechmatics |
| `AZURE_API_KEY` + `AZURE_REGION` | ● | ● | ● | Azure |
| `SMALLEST_API_KEY` | ● | ● | | Smallest AI |
| `GOOGLE_CREDENTIALS_JSON_BASE64` | | ● | | Google TTS |
| `GOOGLE_API_KEY` | ● | | ● | Gemini |
| `META_API_KEY` | ● | | | Meta |

Each `main.py` also reads optional `VERSION` and `LOG_LEVEL`.

## Deployment

Each app deploys as its own service on its own domain from its `Dockerfile`: `yarn build` compiles the frontend into `frontend/dist`, which the backend serves at `/`. Health and version are at `/.well-known/health/<slug>` and `/.well-known/version/<slug>` — slugs `soniox-compare` (stt), `soniox-tts-compare` (tts), `soniox-translation-compare` (translate).

## License

[MIT](LICENSE.txt)
