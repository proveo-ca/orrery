# Backend ⇄ Web Engine — 1:1 Parity Map

> **Purpose.** The desktop backend is the Bun server (`apps/server`, see
> [`behavior.md`](./behavior.md)); the web distribution runs the same loop in
> `apps/ui/src/engine/`. **Both import `@chess-coach/engine-core` for the
> behaviour-defining prompt logic**, so prompt construction / classification /
> commentary extraction is now *one shared implementation*, not two to keep in
> sync. This document confirms the remaining parity and records the surviving
> platform divergences.
>
> **In scope:** orchestration workflow, prompt construction, classification,
> move/eval/commentary algorithms, engine configuration that changes outputs.
> **Out of scope:** optimizations, platform limitations, fallbacks (§4).

---

## 1. Component mapping

| Concern | Bun server (`apps/server`) | Web engine (`apps/ui/src/engine`) | Status |
|---|---|---|---|
| Prompt logic | `@chess-coach/engine-core` | `@chess-coach/engine-core` | ✅ **shared, identical** |
| Orchestrator | `Orchestrator.ts` (in-process) | `Orchestrator.ts` + `orchestrator.worker.ts` | ✅ mirrors |
| HTTP / dispatch | `app.ts` (`Bun.serve`) | `WebWorkerCoachService` (postMessage) | ✅ equivalent contract |
| EngineBridge | `EngineBridge.ts` | `EngineBridge.ts` | ✅ equivalent |
| Stockfish | `StockfishEngine.ts` (Bun.spawn → native) | `StockfishEngine.ts` (stockfish-18-lite wasm) | ✅ eval/FEN parity |
| Maia | `MaiaEngine.ts` (Bun.spawn → lc0 native) | `MaiaEngine.ts` + `maia.worker.ts` (lc0.wasm) | ⚠️ book vs TempDecay (§3.1) |
| UCI driver | `UciDriver.ts` (Bun.spawn) | `UciDriver.ts` (Worker) | ✅ equivalent (queue + readUntil) |
| LLM transport | `OllamaLlmClient.ts` (HTTP) | `WebLlmClient.ts` (@mlc-ai/web-llm) | ✅ equivalent transport |
| Config | `config.ts` (temps/model) + engine-core | `config.ts` (temps/model) + engine-core | ✅ shared prompt; per-platform tuning (§4) |
| State | `StateManager.ts` (`game_state.fen`) | `Orchestrator.currentFen` in-memory | ✅ equivalent (no FS in browser) |
| Web-only | — | `moveNotation.ts`, `moveAnnotations.ts`, `textSanitizer.ts`, `fallbackCommentary.ts`, `polyglotZobrist.ts`, `EnginePool.ts` | web-only (§4) |

---

## 2. Algorithm parity (confirmed 1:1)

- **`executeTurn`** — eval(15) → Maia move → `getFenAfterMove` (null ⇒ throw illegal-move) → set fen. ✅
- **`generateAdviceStream`** — `safeHumanMove = blank ? "e4"`; evalBefore; `fenAfterMove = getFenAfterMove(currentFen, safeHumanMove)`; `evalAfter = fenAfterMove ? eval(fenAfterMove) : evalBefore`; `createMoveAnalysis` (Type=standard); buffer full stream → `extractCommentary` → emit once. `aiMove` unused. ✅
- **`generateExplanationStream`** — evalBefore(fenBefore), evalAfter(fenAfter), `createMoveAnalysis(isForcedBlunder=isBlunder)`, Type=explanation **+ appended `Instruction:` line** (now shared, §3 below). ✅
- **`generateUiPhrases`** — best-effort warmup then the **exact same** `thinking`/`bestMove` arrays. ✅
- **Prompt field order & validation, `classifyMoveTag`, `scoreForPrompt`, `formatCpTransition`, `sideToMoveFromFen`, `extractCommentary`, `buildExplanationInstruction`, `SYSTEM_PROMPT`** — all from `engine-core`, tested in `apps/server/src/llmPromptFormat.test.ts`. ✅ shared
- **Stockfish** `getEvaluation` (depth 15, parse `score cp`/`score mate`/`bestmove`) + `getFenAfterMove` (`d` → `Fen:`, null when unchanged). ✅
- **Maia** difficulty→weights (`intermediate`=1100, `advanced`=1600, `expert`=2200), `go nodes 1`, base `Temperature 0.5`. ✅

---

## 3. Remaining divergence in scope

### 3.1 ⚠️ Opening-book (server) vs temperature-decay (web) — **platform**

Both run lc0 with constant base `Temperature 0.5`; they add early-game variety differently:

- **Server (`apps/server/MaiaEngine.ts`):** native lc0 with `OwnBook=true` +
  `BookFile=openings.bin` (Polyglot book). **No `TempDecayMoves`.**
- **Web (`apps/ui/src/engine/MaiaEngine.ts`):** lc0.wasm with **no** book; instead a
  difficulty-dependent **`TempDecayMoves`** (set per `getMove`): `intermediate`=15,
  `advanced`=12, `expert`=10. (Defined in `getDecay`, not `config.ts`.
  `polyglotZobrist.ts` is **not** a book — it hashes games for localStorage.)
- **Effect:** opening moves differ in the first ~10–15 plies. This is an accepted
  **platform divergence** (a binary Polyglot book is impractical in the lc0.wasm
  worker); the `TempDecayMoves` schedule is the canonical web behavior.

### Resolved by convergence (`@chess-coach/engine-core`)

- ✅ **Explanation `Instruction:` line** (was the HIGH gap): `buildExplanationInstruction(tag)`
  now lives in `engine-core` and `buildPromptFromAnalysis` appends it for
  `type==="explanation"`. **Both** server and web use it. Guarded by
  `apps/server/src/llmPromptFormat.test.ts` + `Orchestrator.test.ts`.
- ✅ **SAN sentence in the system prompt** (was MEDIUM): `engine-core` exports the
  canonical `SYSTEM_PROMPT` (with the SAN sentence); `apps/ui/src/engine/config.ts`
  imports it. Guarded by the system-prompt test.

---

## 4. Intentional / allowed divergences (NOT gaps)

| Area | Server | Web | Why allowed |
|---|---|---|---|
| Commentary model | `qwen2.5:7b` / configurable (Ollama) | `chess-gemma-commentary-q0f32-MLC` (WebGPU) | Different runtime; web model is the fine-tuned target |
| Temperature | 0.7 / 0.7 (`config.ts`) | 0.5 / 0.5 (`config.ts`) | Model-specific tuning |
| Max tokens | 256 / 256 | 128 / 80 | Model-specific tuning |
| Transport | OpenAI HTTP → Ollama | @mlc-ai/web-llm in WebWorker | Platform |
| Syzygy tablebases | `SYZYGY_PATH` (3-4-5) | none | Optimization/limitation |
| Stockfish build | native threaded | `stockfish-18-lite-single` (web), `-lite` threaded (desktop UI) | Limitation (Chrome SAB budget) |
| Maia crash recovery | restart on difficulty change | also restart-and-retry-once on wasm RuntimeError | Defensive |
| Commentary post-proc | `extractCommentary` only | `extractCommentary` → `sanitizeExplanationText` → `isLowQualityLlmOutput` → fallback | **Fallback** (out of scope) |
| `bestAltMatchesMove` | absent | computed (`uciMatchesSan`) for fallback/debug | Feeds fallback only |
| State persistence | `game_state.fen` file | in-memory `currentFen` | Platform (no FS) |
| `/hello` greeting | "Hey! I'm Selena. Let's play chess." | "Hey!" (worker) | Presentation |
| `model` field | `env LLM_MODEL` | `"web-llm"` | Presentation |
| Extra helpers | `checkLegality` (unused) | `getMoveAtElo`, `getSanForUciMove` (hint/analysis) | additive |
| Scheduler | async Mutex (single subprocess) | `EnginePool` priority scheduler (main-thread Stockfish) | Optimization (UI-side) |
| Debug | `LLM_DEBUG` (stderr) | `VITE_DEBUG` → `LLM_DEBUG` postMessage | Equivalent hooks |

---

## 5. Quirks to preserve (do NOT "fix" on one side only)

- **Advice re-applies the human move.** `generateAdviceStream` computes
  `getFenAfterMove(currentFen, safeHumanMove)` even though the caller passes the
  post-human FEN. When the move can't be applied, `evalAfter = evalBefore` ⇒ tag
  `Best`/`Good`. Reproduced identically on both sides (the pre/post-move ambiguity
  formerly tracked in the now-removed `apps/api/ROADMAP.md`). If ever resolved,
  change **both** sides.
- **"Stream" endpoints emit one chunk.** `advice`/`explain` buffer the entire LLM
  output, run `extractCommentary`, and emit a single cleaned chunk. Don't refactor
  one side to token-stream without matching the other.
- **Blank human move → `"e4"`.** Both substitute `"e4"` for a blank `humanMove`.

---

## 6. Verification

- The shared `engine-core` prompt/classification logic is tested once in
  `apps/server/src/llmPromptFormat.test.ts` (field order, Name-omitted, required-field
  errors, `formatCpTransition`, `scoreForPrompt` ±9999, `sideToMoveFromFen`,
  `classifyMoveTag`, `extractCommentary`, the `Instruction:` line, the SAN system
  prompt) — the web engine imports the same module, so it inherits this behavior.
- `apps/server/src/Orchestrator.test.ts` covers executeTurn (legal/illegal), the
  advice/explanation stream semantics, and the prompt fields.
- `apps/server/src/routes.test.ts` covers the HTTP contract + COOP/COEP + error mapping.
- Web-only concerns (worker plumbing, `EnginePool`, sanitizer/fallback) keep their
  own tests under `apps/ui`.
