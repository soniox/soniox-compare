# Soniox Comparison Tool

## Running the Project

**Backend (FastAPI - Project Root):**

```bash
# Run the backend server:
uv run fastapi dev
# Backend runs on: http://127.0.0.1:8000
```

**Frontend (React/Vite - `frontend/` directory):**

```bash
cd frontend
# Ensure Node.js and yarn are installed
yarn dev
# Frontend runs on: http://localhost:5173/compare/ui/ (proxies to backend)
```

## Core Settings & Configuration

**Backend (Project Root):**

*   **Provider Implementations**: `providers/<provider_name>/provider.py`
    *   Each provider (e.g., `soniox`, `google`) has its own subdirectory in `providers/`.
*   **Provider Configuration**: `config.py` (see `get_provider_config` function).
    *   Loads API keys and settings primarily from environment variables.
    *   Google provider might require `credentials-google.json` in the root directory.
*   **Main Application Logic**: `main.py` (FastAPI routes, WebSocket handling for `/compare/api/compare-websocket`).
*   **Environment Variables**: Create a `.env` file in the project root to store API keys (e.g., `SONIOX_API_KEY`, `AZURE_API_KEY`, etc.). This is loaded by `load_dotenv()` in `main.py` and `config.py`.

**Frontend (`frontend/` directory):**

*   **Core Logic & State**: `src/contexts/comparison-context.tsx`
    *   Manages WebSocket connection, audio processing, and application state.
*   **Mock Data Toggle**: `USE_MOCK_DATA` constant in `src/contexts/comparison-context.tsx`.
*   **UI Components**: `src/components/`
*   **API Proxy (Vite)**: `vite.config.ts` (proxies `/compare` calls to backend at `http://127.0.0.1:8000`).
*   **Provider UI Names/Features**: `src/lib/provider-features.ts`.
*   **Comparison UI Settings (Dropdowns, etc.)**: `src/lib/comparison-constants.ts`.