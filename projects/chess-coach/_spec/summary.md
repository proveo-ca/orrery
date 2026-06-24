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
- **Architecture:** Client-Server. The UI connects to a Bun REST server (`apps/server`).
- **Orchestration:** The Bun server runs the execution loop **in-process** — managing state (`game_state.fen`) and engine/LLM I/O directly (no separate daemon or wire protocol). Prompt logic is shared with the web build via `@chess-coach/engine-core`.
- **Engines:** The UI still uses one local `stockfish.wasm` worker for instant hover evaluations and hints. However, the *backend* uses native Stockfish binaries and Maia (lc0) for the AI opponent's moves.
- **LLM:** The backend connects to a local or remote Ollama instance via HTTP.

## LAN / Online Multiplayer (serverless host-hub — Tailscale + WebRTC)
A **human-vs-human** mode that needs **no backend**: the harness, Ktor, Maia and the LLM are not involved. It ships in the client-only web / PWA build and is reached from `/chess/lan` (`LanScreen`).

- **Connectivity:** every participant installs **Tailscale** and joins the same tailnet; devices get stable `100.x` IPs with no NAT.
- **Transport:** browsers talk **peer-to-peer over WebRTC `RTCDataChannel`**. Because the tailnet has no NAT, WebRTC connects via **host ICE candidates** — **no STUN / TURN / relay** (`iceServers: []`).
- **Topology — host-hub:** the room creator's browser is the **hub** (room authority); the other player and observers each open a DataChannel to it. The host runs the authoritative `chess.js` game and relays every move + room-state update.
- **Signaling (serverless):** WebRTC still needs a one-time offer/answer exchange. With no server this is **manual & out-of-band** — the host shows a **QR code / shareable link** (`/chess/lan#o=…`) and the joiner returns an answer QR/link (`#a=…`), one exchange per joiner. Non-trickle ICE keeps each blob to a single QR.
- **Room:** two **player seats** plus **up to 4 optional observers**. **Colors are not assigned by default** — each player picks **White** or **Black** in the lobby and may select the opposite seat to **swap**; any color change resets both ready votes. Colors lock only when **both players press Start Game** (observers never required). The host browser **is** the room — if it closes, the room ends.
- **Known risk:** mobile browsers may obfuscate the `100.x` host candidate with `.local` mDNS names; whether the tailnet path survives that must be validated on real devices before relying on the design.

## Rendering & UI (SolidJS)
A minimal Single Page Application (SPA) using SolidJS.
- **State Management:** FEN history and move history are stored client-side, allowing instant replayability without backend calls.
- **Hinting & Hover Evals:** The UI queries a dedicated Stockfish Web Worker directly for real-time hints and blunder detection on hover, regardless of the distribution medium.
