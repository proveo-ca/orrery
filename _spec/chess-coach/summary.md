# Harness 1: Chess Coach

## Overview
This harness provides a local, Dockerized environment where an LLM (Qwen 2.5) acts as an interactive chess coach. It is designed for research purposes to observe how lightweight, multi-agent systems collaborate to provide structured game analysis, hinting, and replayability.

## Paradigm Decision: Anti-Framework
This harness will be the **Anti-framework** implementation. 
**What influences this decision?** 
- **Goal:** To gain deep experience with the fundamental execution loops, raw prompting, and tool calling mechanics without the black-box abstractions of heavy frameworks (like LangChain or AutoGen).
- **Simplicity:** A chess game loop is deterministic and straightforward. Writing raw Kotlin CLI tools and Bash scripts to orchestrate the loop provides maximum control and performance visibility.
- **Comparison:** The second planned harness will utilize a framework, allowing for a direct comparison of development speed, maintainability, and execution overhead against this anti-framework baseline.

## Rendering & UI (SolidJS + Ktor)
To provide a smooth, visual experience while keeping the backend "anti-framework", we utilize a lightweight web frontend.
- **Frontend (SolidJS):** A minimal Single Page Application (SPA) using SolidJS and a compatible visual chessboard library (e.g., a lightweight SolidJS wrapper around `chessground`).
- **Backend Bridge (Ktor):** A tiny Ktor web server serves the static SolidJS assets and acts as the crucial bridge between the human and the Bash-orchestrated agents.

**Replayability & History:**
- The UI allows the player to move the FEN state back and forth through the move history.
- The Ktor backend exposes endpoints to navigate the `game_history.pgn` and serve the historical FEN states.

**Hinting System:**
- The player can request a hint. Ktor queries Stockfish directly (via the Kotlin Engine Bridge) for the top 3 best moves.
- These moves, along with their evaluation scores, are displayed to the player, allowing them to learn and explore optimal lines.

**How Ktor bridges the human and the agents:**
1. **The Web API:** Ktor exposes simple REST endpoints (e.g., `POST /api/move`, `GET /api/hint`, `GET /api/history`).
2. **The Hand-off:** When a human makes a move, the SolidJS UI sends the move (SAN) to Ktor. Ktor then acts as a process manager, executing the Bash Orchestrator via a system subprocess call (e.g., `ProcessBuilder("bash", "orchestrator.sh", move).start()`).
3. **The Wait:** Ktor waits for the Bash orchestrator to finish its execution loop (Agent Analysis -> Generation -> Validation -> FEN Update).
4. **The Return:** Once the Bash process exits successfully, Ktor reads the updated `game_state.fen` and returns the new board state to the SolidJS UI.

## Engine & Notation Details
- **Stockfish Integration:** Stockfish will be used primarily as a grounding, validation, and hinting mechanism. It validates move legality, evaluates the current position to provide the LLM with tactical context, and serves the top 3 hints when requested by the player.
- **Internal Notation (SAN vs FEN vs UCI):**
  - **FEN (Forsyth-Edwards Notation):** Will be used as the absolute source of truth for the *board state*. It is a complete snapshot.
  - **SAN (Standard Algebraic Notation):** **Yes**, SAN will be heavily used internally for *LLM communication*. LLMs are extensively trained on PGNs (Portable Game Notations), which use SAN. Asking the LLM to output moves in SAN is generally more reliable than UCI.
  - **UCI (Universal Chess Interface):** Will be used exclusively for communication between our Kotlin tools and the underlying Stockfish engine.

## Sub-agent Architecture
1. **State Analyzer Agent:** Interprets the current FEN and Stockfish evaluation, translating it into a natural language summary of threats, opportunities, and positional nuances.
2. **Strategy Agent:** Receives the summary and generates candidate moves in SAN for the opponent (if playing a full game) or provides pedagogical commentary.
3. **Validation & Execution Agent:** Uses Kotlin tools to validate the SAN move against the current FEN (using Stockfish under the hood). If legal, updates the state.
4. **Dialogue Agent:** Translates the move, state, and Stockfish evaluations into conversational, constructive coaching advice or commentary.

## Tooling (Bash/Kotlin)
- **Ktor Server (Kotlin):** The HTTP bridge and process manager. Connects the UI to the Bash orchestration layer, handles PGN history traversal, and fetches hints.
- **Engine Bridge (Kotlin):** A CLI wrapper around Stockfish. Takes UCI commands or FEN strings and returns evaluations, legal moves, or the top 3 best moves (MultiPV).
- **Move Validator (Kotlin):** Parses a proposed SAN move and validates it against the current FEN.
- **State Manager (Bash):** Orchestrated by Ktor, it handles the execution loop, calling the Kotlin CLI tools and the LLM API, and updating the FEN/PGN files.

## Diagrams
Please see the accompanying PlantUML diagrams for visual representations of the architecture and workflow:
- `architecture.puml`: Component and agent architecture.
- `sequence.puml`: Execution flow for a single turn and hinting.