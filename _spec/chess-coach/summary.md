# Harness 1: Chess Coach

## Overview
This harness provides an interactive chess coach environment. It is designed as an **Anti-framework** implementation to explore fundamental execution loops, raw prompting, and tool calling mechanics without black-box abstractions.

## Dual Distribution Mediums
The application is built to be deployed in two entirely different ways, sharing the same SolidJS UI but swapping the orchestration layer based on the environment (`VITE_TARGET`).

### 1. Cloudflare Workers (Web Mode)
- **Target:** `VITE_TARGET=web`
- **Hosting:** Cloudflare Pages / Workers.
- **Architecture:** 100% Client-Side. The UI runs entirely in the browser.
- **Orchestration:** A dedicated Web Worker (`orchestrator.worker.ts`) handles the execution loop.
- **Engines:** Uses `stockfish-18-lite.js` (WASM) for both UI hints/hover analysis *and* the AI opponent's moves.
- **LLM:** Uses `@mlc-ai/web-llm` (WebGPU) to run models like `Llama-3.1-8B-Instruct` directly on the user's local hardware via the browser.

### 2. Docker Compose (Server/Desktop Mode)
- **Target:** Default (no target specified).
- **Hosting:** Local Docker Compose or remote VPS.
- **Architecture:** Client-Server. The UI connects to a Ktor REST API.
- **Orchestration:** A Kotlin CLI daemon (Harness) manages the execution loop, state (`game_state.fen`), and tool calling.
- **Engines:** The UI still uses one local `stockfish.wasm` worker for instant hover evaluations and hints. However, the *backend* uses native Stockfish binaries and Maia (lc0) for the AI opponent's moves.
- **LLM:** The backend connects to a local or remote Ollama instance via HTTP.

## Rendering & UI (SolidJS)
A minimal Single Page Application (SPA) using SolidJS.
- **State Management:** FEN history and move history are stored client-side, allowing instant replayability without backend calls.
- **Hinting & Hover Evals:** The UI queries a dedicated Stockfish Web Worker directly for real-time hints and blunder detection on hover, regardless of the distribution medium.
