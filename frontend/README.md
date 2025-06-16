# Soniox STT Comparison UI Frontend

This frontend application provides a user interface for real-time comparison of Speech-to-Text (STT) providers, with Soniox as the primary provider and another selectable provider for side-by-side evaluation.

## Key Technologies

*   **React**: JavaScript library for building user interfaces.
*   **Vite**: Fast frontend build tool and development server.
*   **TypeScript**: Superset of JavaScript adding static typing.
*   **Tailwind CSS**: Utility-first CSS framework for rapid styling.
*   **Shadcn/ui**: Re-usable UI components built with Radix UI and Tailwind CSS.
*   **AudioWorklet**: For performant audio processing in a separate thread.

## Project Structure

```
frontend/
├── public/
│   └── audio-processor.js  # AudioWorklet for microphone input processing
├── src/
│   ├── components/         # Reusable UI components (Panels, Buttons, etc.)
│   ├── contexts/
│   │   └── comparison-context.tsx # Core state management, audio & WebSocket logic
│   ├── lib/
│   │   ├── comparison-constants.ts # Dropdown options, etc.
│   │   ├── mock-transcript-data.ts # Sample data for mock WebSocket
│   │   ├── mock-websocket.ts    # Mock WebSocket implementation
│   │   └── provider-features.ts # UI names and feature flags for providers
│   ├── app.tsx             # Main application component, layout
│   ├── main.tsx            # Entry point, renders App into the DOM
│   └── index.css           # Global styles, Tailwind imports, CSS variables
├── index.html              # Main HTML file
├── vite.config.ts          # Vite configuration (proxy, plugins)
└── tsconfig.json           # TypeScript configuration
```

## Getting Started

### Prerequisites

*   Node.js (LTS version recommended)
*   Yarn (package manager): `npm install -g yarn`

### Setup & Development

1.  **Navigate to the frontend directory:**
    ```bash
    cd frontend
    ```

2.  **Install dependencies:**
    ```bash
    yarn install
    ```

3.  **Run the development server:**
    ```bash
    yarn dev
    ```
    The application will be available at `http://localhost:5173/compare/ui/` (or the next available port).

    The Vite dev server is configured with a proxy. API requests to `/compare/api` (including the WebSocket endpoint `/compare/api/compare-websocket`) will be proxied to `http://127.0.0.1:8000` (the expected FastAPI backend - which you need to run separately using `fastapi dev main.py` in the backend directory).

### Building for Production

```bash
yarn build
```
This command creates a `dist` directory with optimized static assets for deployment.

## Core Concepts

### State Management & Core Logic (`comparison-context.tsx`)

The primary application state and logic are managed within `ComparisonContext`. This includes:

*   **Recording State**: `idle`, `starting`, `audioworkletloading`, `connecting`, `recording`, `stopping`.
*   **Provider Outputs**: Stores transcript data (final and non-final parts), errors, and status messages for Soniox and the selected comparison provider.
*   **UI Settings**: Selected operation mode (STT/MT), input language, target translation language, and the comparison provider.
*   **Actions**:
    *   `startRecording()`: Initiates microphone access, loads the `AudioWorklet`, and establishes a WebSocket connection.
    *   `stopRecording()`: Terminates the recording, cleans up resources.
    *   `clearTranscriptOutputs()`: Clears displayed transcripts.
    *   Setters for UI settings.

### Audio Processing (`public/audio-processor.js`)

*   An `AudioWorkletProcessor` is used to capture raw audio data from the microphone.
*   It converts the audio from Float32Array to 16-bit PCM (Int16Array) and sends it to the main thread.
*   The main thread then forwards this PCM data to the active WebSocket connection.

### WebSocket Communication

*   The frontend connects to a WebSocket endpoint (e.g., `ws://localhost:5173/compare/api/compare-websocket`, proxied to the backend).
*   Parameters like `mode`, `input_languages`, `target_translation_language`, and active `providers` are sent as URL query parameters.
*   The WebSocket receives JSON messages containing transcript parts (`text`, `is_final`, `speaker`, `language`, etc.) or error messages from the backend for each provider.

### Mocking for UI Development

*   **`USE_MOCK_DATA`**: A boolean constant in `frontend/src/contexts/comparison-context.tsx`. Set to `true` to use mock data.
*   **`MockWebSocket` (`frontend/src/lib/mock-websocket.ts`)**: If `USE_MOCK_DATA` is true, this class is instantiated instead of a real `WebSocket`. It simulates WebSocket messages using data from `frontend/src/lib/mock-transcript-data.ts`.
*   This allows for UI development and testing without a running backend or live audio input.

## Development Notes

*   **Adding UI Components**: Use Shadcn/ui for new components (`yarn shadcn@latest add <component-name>`) or create custom components in `src/components/`.
*   **Modifying State/Logic**: Most core changes will likely involve `comparison-context.tsx`.
*   **Updating Provider Information**: Edit `provider-features.ts` for UI display names or feature flags.
*   **Changing Mock Data**: Update `mock-transcript-data.ts` for different test scenarios.
*   **Styling**: Utilize Tailwind CSS utility classes directly in your components. Global styles or CSS variables can be added to `src/index.css`.
