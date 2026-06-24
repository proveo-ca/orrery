# Chess Coach Backend — Behavioral Contract

> **Source of truth.** This document captures 100% of the observable behavior and
> workflow orchestration of the desktop backend — a single **Bun server**
> (`apps/server/`) that runs the Maia + commentary-agent + Stockfish loop
> **in-process**. (It replaced the original Kotlin `apps/api` Ktor bridge +
> `apps/harness` daemon; the migration preserved the behavior contract below —
> the prompt-construction logic is now shared verbatim via
> `@chess-coach/engine-core`.)
>
> The web distribution runs the same loop in the browser under
> `apps/ui/src/engine/` and shares `engine-core`. The intended contract is **1:1 behavior**. Divergences
> and the parity checklist live in [`ui-engine-parity.md`](./ui-engine-parity.md).
> The visual workflow is in [`orchestration.puml`](./orchestration.puml); the
> component breakdown is in [`components.puml`](./components.puml).
>
> Scope note: "behavior" here means request/response contracts, the orchestration
> algorithm, prompt construction, classification, and engine configuration that
> changes outputs. Optimizations, platform limitations, and fallbacks are called
> out but are explicitly **not** part of the 1:1 contract (per task scope).

---

## 1. Topology

```
SolidJS UI ──HTTP/JSON──▶ Bun server (apps/server)
                              │  (in-process; no daemon, no JSON-line protocol)
                              ├─ Orchestrator ─┬─ EngineBridge ─┬─ StockfishEngine (Bun.spawn → native stockfish)
                              │                │                └─ MaiaEngine (Bun.spawn → lc0 + maia weights)
                              │                └─ OllamaLlmClient (OpenAI-compatible HTTP → Ollama)
                              └─ @chess-coach/engine-core (shared prompt logic, also used by apps/ui)
```

The Bun server serves the UI, terminates HTTP, and runs the orchestrator
**in-process** — spawning native `stockfish`/`lc0` subprocesses and calling Ollama.
There is no separate process or wire protocol between HTTP and orchestration.

---

## 2. HTTP API surface (`apps/server`, `Bun.serve`)

| Route | Method | Request DTO | Response | Streaming |
|---|---|---|---|---|
| `/hello` | GET | — | `HelloResponse(model, greeting, thinking[], bestMove[])` | no |
| `/move` | POST | `MoveRequest(humanMoveSan, fenAfterHuman, difficulty="intermediate")` | `MoveResponse(fen, move)` | no |
| `/advice` | POST | `AdviceRequest(humanMove, aiMove, fen)` | `text/plain` body | **yes** (chunked) |
| `/explain` | POST | `ExplainRequest(fenBefore, fenAfter, isBlunder=true, moveSan="")` | `text/plain` body | **yes** (chunked) |
| `/new` | POST | — | `NewGameResponse(fen)` | no |
| `/` | GET | — | redirect → `/chess` | — |
| `/*` | GET | — | static SolidJS build (`static/`, default `index.html`) | — |

Behavioral details:

- **`/hello`** — `model = env LLM_MODEL ?? ""`; `greeting = "Hey! I'm Selena. Let's play chess."` (constant); `thinking`/`bestMove` come from `orchestrator.generateUiPhrases()`.
- **`/move`** — writes `fenAfterHuman` to state (if non-empty), then returns `orchestrator.executeTurn(...)`'s `{fen, move}` directly.
- **`/advice`, `/explain`** — a `text/plain` `ReadableStream`; each generator chunk is `enqueue`d. On client abort the stream's `cancel()` sets a flag and the generator is **drained** (kept iterating, writes suppressed) so the engines are released cleanly.
- **`/new`** — `stateManager.resetGame()` writes the starting FEN to `game_state.fen` (creating parent dirs), then returns `readFen()`.

### Error mapping (`errorResponse`, `apps/server/http.ts`)

| Condition | HTTP status | Body |
|---|---|---|
| `UciTimeoutError` / per-request `TimeoutError` | 504 | `{ error: "Harness request timed out" }` |
| `SyntaxError` (malformed JSON body) | 400 | `{ error: <message> }` |
| anything else | 500 | `{ error: <message> }` |

### Default headers / CORS (`BASE_HEADERS`)

- `Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Embedder-Policy: require-corp` (required for WASM threads on the static SolidJS app) — applied to every response.
- CORS `Access-Control-Allow-Origin: *`, allows `Content-Type`, methods GET/POST/OPTIONS/PUT/PATCH/DELETE. `OPTIONS` → 204.

### Server binding

- `HOST` (default `0.0.0.0`), `PORT` (default `8080`). Logs a frontend URL using `PUBLIC_HOST`/`PUBLIC_PORT` (falls back to `localhost` when bound to `0.0.0.0`).

---

## 3. In-process dispatch & concurrency

There is **no daemon and no JSON-line protocol** — the Bun server runs the
orchestrator in-process. `createFetchHandler` (`apps/server/app.ts`) maps each
route directly to an `Orchestrator` method:

| Route | Orchestrator call | Emits |
|---|---|---|
| `GET /hello` | `generateUiPhrases()` | `{ model, greeting, thinking[], bestMove[] }` |
| `POST /move` | if `fenAfterHuman` → `stateManager.writeFen(...)`; `executeTurn(humanMoveSan, difficulty)` | `{ fen, move }` |
| `POST /advice` | `generateAdviceStream(humanMove, aiMove, fen)` | text/plain stream (single cleaned chunk) |
| `POST /explain` | `generateExplanationStream(fenBefore, fenAfter, isBlunder, moveSan)` | text/plain stream (single cleaned chunk) |
| `POST /new` | `stateManager.resetGame()` then `readFen()` | `{ fen }` |

Concurrency rules (`apps/server/http.ts`):
- An async **`Mutex`** serializes all engine access (Stockfish/Maia are single
  subprocesses) — no two orchestrator operations run concurrently.
- Unary ops (`/move`, `/hello`) are wrapped in **`withTimeout(HARNESS_REQUEST_TIMEOUT_MS,
  default 60 000 ms)`** → 504 on expiry.
- Streaming ops hold the mutex for the stream's duration; on client abort the
  generator is **drained** (kept iterating, writes suppressed).
- Engine subprocess lifecycle lives in the `UciDriver`s (background stdout reader,
  stderr drain, restart-on-difficulty for Maia). There is no daemon to reap and no
  idle reaper.

---

## 4. Orchestration algorithms (`apps/server/Orchestrator.ts`; mirrored by `apps/ui`)

### 4.1 `executeTurn(humanMove, difficulty) → TurnResult(fen, move, advice="")`

1. `currentFen = stateManager.readFen()` (the `/move` handler already wrote `fenAfterHuman`).
2. `evalResult = engineBridge.getEvaluation(currentFen, depth=15)` — **logged only**, not used downstream.
3. `candidateMove = engineBridge.getMaiaMove(currentFen, difficulty)`.
4. `newFen = engineBridge.getFenAfterMove(currentFen, candidateMove)`; if `null` → throw `IllegalStateException("Maia generated an illegal move: …")`.
5. `stateManager.writeFen(newFen)`.
6. Return `{ fen=newFen, move=candidateMove, advice="" }`.

> The Stockfish eval in step 2 is informational (stderr logging). The AI move is **purely Maia**; no LLM is involved in move selection.

### 4.2 `generateAdviceStream(humanMove, aiMove, currentFen) → Flow<String>` (Type=`standard`)

1. `safeHumanMove = humanMove.isBlank() ? "e4" : humanMove`.
2. `evalBefore = getEvaluation(currentFen, 15)`.
3. `fenAfterMove = getFenAfterMove(currentFen, safeHumanMove)`.
4. `evalAfter = fenAfterMove != null ? getEvaluation(fenAfterMove, 15) : evalBefore`.
5. `analysis = createMoveAnalysis(fenBefore=currentFen, fenAfter=fenAfterMove ?? currentFen, moveSan=safeHumanMove, evalBefore, evalAfter, actor="human", gender="neutral", mateScore=9999, name="")`.
6. `prompt = buildPromptFromAnalysis(analysis, "English", "en", "standard")`.
7. `promptStream(SYSTEM_PROMPT, prompt, commentaryModel, temperature=0.7, maxTokens=256)`.
8. **Collect the full stream into a buffer**, then `extractCommentary(buffer)`, emit **once** if non-blank (`collectCommentaryFlow`). Despite the streaming transport, the consumer sees a single cleaned chunk.
9. `aiMove` is accepted but **unused**.

> `LLM_DEBUG=true` logs the prompt, raw response, and extracted commentary to stderr for both advice and explanation. (The Kotlin-only non-stream `generateAdvice` / CLI mode / `SkillLoader` are gone; the server exposes only the stream variants.)

### 4.3 `generateExplanationStream(fenBefore, fenAfter, isBlunder, moveSan) → Flow<String>` (Type=`explanation`)

1. `evalBefore = getEvaluation(fenBefore, 15)`, `evalAfter = getEvaluation(fenAfter, 15)`.
2. `analysis = createMoveAnalysis(fenBefore, fenAfter, moveSan, evalBefore, evalAfter, actor="human", gender="neutral", mateScore=9999, isForcedBlunder=isBlunder, name="")`.
3. `prompt = buildPromptFromAnalysis(analysis, "English", "en", "explanation")` — **appends the explanation instruction** (§5.4).
4. `promptStream(SYSTEM_PROMPT, prompt, commentaryModel, temperature=0.7, maxTokens=256)` — explanation temp/tokens.
5. Buffer fully → `extractCommentary` → emit once if non-blank.

### 4.4 `generateUiPhrases() → UiPhrases`

- Best-effort warmup: `prompt("System", "Ping", commentaryModel, maxTokens=1)` (catches and logs failures — never throws).
- Returns constants:
  - `thinking = ["Hmm...", "Let me think...", "Interesting position...", "Rats...", "What to do..."]`
  - `bestMove = ["Great move!", "Excellent!", "I like that.", "Strong play.", "Well done."]`

---

## 5. Prompt construction (`@chess-coach/engine-core` + `apps/server/config.ts`)

> §5.1–§5.5 are implemented in the shared `engine-core` and used **verbatim** by
> both the Bun server and the browser engine.

### 5.1 System prompt (`engine-core` `SYSTEM_PROMPT`)

```
Generate professional chess commentary in the specified language. Always use Standard Algebraic Notation (SAN) for moves (e.g., Nf3, e4). For Type=standard use 30–40 words. For Type=explanation, explain the best move briefly (≤50 words). Return exactly: Commentary, Predicted ELO, Verified Classification.
```

### 5.2 Structured user prompt — exact field order

For the `chess-gemma-commentary` model card. `buildStructuredPrompt` emits these lines, in order; `Name` is omitted when blank:

```
LanguageL: <language>
LangCode: <langCode>
Type: <standard|explanation>
FEN: <fenBefore>
MoveSAN: <moveSan>
Side: <White|Black>
Actor: <actor>
[Name: <name>]        # only if non-blank, trimmed
Gender: <gender>
Tag: <tag>
BestAlt: <bestAlt trimmed, may be empty>
CP: <cpBefore->cpAfter (Δ=cpBefore-cpAfter)>
```

- **Required (non-blank, else thrown `Error`)**: LanguageL, LangCode, Type, FEN, MoveSAN, Side, Actor, Gender, Tag, CP. (`BestAlt` and `Name` may be empty/omitted.)
- `Side = sideToMoveFromFen(fenBefore)` — FEN field 2 (`w`→White, else Black).
- `BestAlt = evalBefore.bestMove` (UCI, e.g. `g1f3`).
- `CP` uses `formatCpTransition(before, after) = "<before>-><after> (Δ=<before-after>)"`.

### 5.3 Score & classification

- `scoreForPrompt(eval, mateScore=9999)`: non-mate → `cp`; mate → `+9999` if `mateIn>0` else `-9999`.
- `classifyMoveTag(before, after, isForcedBlunder=false)`:
  - `isForcedBlunder` → `"Blunder"` (short-circuit).
  - else `delta = abs(after - before)`:
    - `delta < 20` → `"Best"`
    - `delta > 200` → `"Mistake"`
    - `delta > 100` → `"Inaccuracy"`
    - otherwise → `"Good"`

  (Note the asymmetric thresholds: 20–100 = Good, 101–200 = Inaccuracy, ≥201 = Mistake.)

### 5.4 Explanation instruction (appended only when `type=="explanation"`)

`buildPromptFromAnalysis` appends a newline + a tag-specific instruction:

- **Blunder**: "Instruction: Write the commentary in future tense. Explain why the played move will be a serious error that will allow tactical or positional punishment, and explain why the best alternative will be clearly stronger. Keep the explanation brief, concrete, and chess-specific. Do not use past tense or present tense."
- **Mistake / Inaccuracy**: "Instruction: Write the commentary in future tense. Explain why the played move will be less accurate or less efficient than the best alternative, and explain what the best alternative will improve. Keep the explanation brief, concrete, and chess-specific. Do not use past tense or present tense."
- **else (Best/Good)**: "Instruction: Write the commentary in future tense. Explain why the played move itself will be strong, useful, and beneficial in the position. Focus on the move's strategic or tactical value. Do not describe the move as inferior, and do not suggest an alternative move unless it is clearly necessary. Keep the explanation brief, concrete, and chess-specific. Do not use past tense or present tense."

> `standard` prompts get **no** instruction appended.

### 5.5 `extractCommentary(raw)`

1. Normalize CRLF→LF, trim. Empty → `""`.
2. Regex (case-insensitive, dot-matches-newline):
   `(?:^|\n)Commentary:\s*(.+?)(?:\n(?:Predicted ELO|Verified Classification):|\n*$)` → return group 1 trimmed.
3. Fallback: first non-empty line that does **not** start with `Predicted ELO:` or `Verified Classification:` (case-insensitive), else `""`.

### 5.6 Config constants (`engine-core` + `apps/server/config.ts`)

> `SYSTEM_PROMPT`, `MATE_SCORE_FOR_PROMPT`, `DEFAULT_EVAL_DEPTH` live in `engine-core`
> (shared). Temperatures/token caps live in `apps/server/config.ts` (backend tuning).

| Constant | Value |
|---|---|
| `DEFAULT_TEMPERATURE` | 0.7 |
| `DEFAULT_MAX_TOKENS` | 256 |
| `EXPLANATION_TEMPERATURE` | 0.7 |
| `EXPLANATION_MAX_TOKENS` | 256 |
| `DEFAULT_LANGUAGE` / `DEFAULT_LANG_CODE` | English / en |
| `DEFAULT_ACTOR` / `DEFAULT_GENDER` / `DEFAULT_NAME` | human / neutral / "" |
| `DEFAULT_EVAL_DEPTH` | 15 |
| `MATE_SCORE_FOR_PROMPT` | 9999 |

---

## 6. Commentary LLM transport (`apps/server/OllamaLlmClient.ts`)

- OpenAI-compatible `POST {baseUrl}/chat/completions` via `fetch`. `baseUrl = LLM_BASE_URL ?? OLLAMA_BASE_URL ?? "http://localhost:11434/v1"`.
- Optional bearer auth from `LLM_API_KEY`.
- Models: `generalModel = LLM_GENERAL_MODEL ?? LLM_MODEL ?? "qwen2.5:7b"`; `commentaryModel = LLM_COMMENTARY_MODEL ?? generalModel`.
- Messages: `[{system}, {user}]`. Request includes `model`, `temperature`, optional `max_tokens`.
- Unary: returns `choices[0].message.content ?? ""`.
- Stream: `stream=true`; parses SSE lines `data: {...}` (ignores `data: [DONE]` and unparseable chunks), emits `choices[0].delta.content` when non-empty.
- No explicit per-call HTTP timeout; unary ops are bounded by the HTTP-layer `withTimeout` (default 60 s).

---

## 7. Engine layer

### 7.1 `apps/server/MaiaEngine.ts` (AI move generation — lc0 policy network)

- Lazily starts lc0. **Restarts only when `difficulty` changes** (weights file change).
- `difficulty → weights`: `advanced`→`maia-1600.pb.gz`, `expert`→`maia-2200.pb.gz`, else (`intermediate`)→`maia-1100.pb.gz`. Weights dir default `/app/weights`.
- Launch: `lc0 --weights=<dir>/<file> --backend=blas`.
- Options on start: `OwnBook=true`, `BookFile=<dir>/openings.bin` (**Polyglot opening book**), `Temperature=0.5`. Waits for `isready`/`readyok`.
- **The only difficulty-dependent parameter is the weights file.** Base `Temperature` is a constant `0.5` for all difficulties, and the backend sets **no** `TempDecayMoves`. (The web engine instead varies `TempDecayMoves` by difficulty — 15/12/10 — see [`ui-engine-parity.md`](./ui-engine-parity.md) §3.3.)
- `getMove(fen, difficulty)`: `position fen <fen>` / `go nodes 1` (1 node is enough for a policy net) → parse `bestmove <uci>`; throw if none. Timeout 30 000 ms.

### 7.2 `apps/server/StockfishEngine.ts` (evaluation / legality / FEN derivation)

- Launch `stockfish`; if `SYZYGY_PATH` set, `setoption name SyzygyPath value <path>` (3-4-5-piece tablebases).
- `getEvaluation(fen, depth=15)`: `position fen` / `go depth <d>`; parse `score cp <n>`, `score mate <n>` (sets `isMate`, `mateIn`), and final `bestmove`. Returns `EvalResult(bestMove, cp, isMate, mateIn)`. Timeout 15 000 ms.
- `checkLegality(fen, move)`: `position fen … moves <m>` / `go depth 1`; legal unless a line contains `"Illegal move"`. (Not used by the orchestrator; kept for completeness.)
- `getFenAfterMove(fen, uci)`: `position fen … moves <uci>` / `d`; read until `Checkers:`, take `Fen: <…>`. Returns `null` if the FEN is unchanged or empty (→ treated as illegal by the orchestrator).

### 7.3 `apps/server/UciDriver.ts` (process plumbing — `Bun.spawn`, shared by both engines)

- Async background stdout reader → line queue; background stderr drainer (prevents full-buffer deadlock).
- `send`, `readLine(timeout)` (splice-on-timeout so a late line can't poison the next read), `waitFor(token, timeout)`, `readUntil(stopToken, timeout)` (returns all lines incl. the stop line). Timeout → `UciTimeoutError`.
- UCI handshake on start: `uci` / wait `uciok`. `stop` sends `quit` and kills the subprocess.

### 7.4 `apps/server/EngineBridge.ts`

Thin facade: `start()` (starts Stockfish; Maia lazy), `stop()`, `getEvaluation`, `checkLegality`, `getFenAfterMove`, `getMaiaMove`.

---

## 8. State (`apps/server/StateManager.ts`)

- FEN file path: `CHESS_STATE_DIR` env (if set) + `/game_state.fen`, else `game_state.fen` (cwd).
- Starting FEN: `rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1`.
- `readFen()` returns trimmed file contents, or the starting FEN if absent.
- `writeFen(fen)` / `resetGame()` create parent dirs then write.

---

## 9. Move-context semantics (known ambiguity)

A long-standing ambiguity (previously tracked in the now-removed
`apps/api/ROADMAP.md`): `/advice` does not pin whether `fen` is pre- or
post-move. In practice `generateAdviceStream` treats its `currentFen` as the
**pre-move** position for `safeHumanMove` (it computes `getFenAfterMove(currentFen,
safeHumanMove)`), while the `/advice` handler passes `fen` (post-move) as
`currentFen`. The orchestrator's `getFenAfterMove` returns `null` when
the move can't be applied, in which case `evalAfter` falls back to `evalBefore`
(so the move is classified `Best`/`Good`). This quirk is **reproduced identically**
by the web engine and is documented here only so it is not "fixed" on one side and
not the other. See [`ui-engine-parity.md`](./ui-engine-parity.md) §Quirks.
