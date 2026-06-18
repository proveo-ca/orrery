# Chess Coach — Project Notes

## Specs are living documents

Architecture specs live in `_spec/chess-coach/` (relative to the harness root).
They are **not snapshots** — they must stay in sync with the source.

When you add, rename, or remove a component, hook, store, or service:
1. Update the relevant `.puml` file(s) to reflect the change.
2. Keep the `// SPEC: _spec/chess-coach/...` comment at the top of any source file that appears in a diagram.
3. If a file is no longer referenced by any spec, remove its comment.

### Spec index

| File | Covers |
|---|---|
| `_spec/chess-coach/components.puml` | Full-stack architecture: UI ↔ API ↔ Harness; runtime modes (desktop / web-full / web-no-llm) |
| `_spec/chess-coach/ui/components.puml` | UI component graph: screens, hooks, stores, services, web-engine (no method bodies) |
| `_spec/chess-coach/ui/entities.puml` | Full API reference: all store selectors/mutations, hook contracts, service interfaces, engine methods |
| `_spec/chess-coach/ui/scheduler.puml` | EnginePool scheduler: workers, priority tiers + preemption, legacy-vs-pool differences |
| `_spec/chess-coach/sequence.puml` | Move, hint, and advice request flows (end-to-end) |
| `_spec/chess-coach/web-llm-integration.puml` | WebLLM model loading and Linux/WebGPU workaround |
| `_spec/chess-coach/architecture.puml` | Top-level system architecture |
| `_spec/chess-coach/api/components.puml` | Ktor API component breakdown |
| `_spec/chess-coach/harness/components.puml` | Harness daemon components |
| `_spec/chess-coach/harness/lifecycle.puml` | Harness lifecycle and agent orchestration |

## Key architecture notes

- **Dual distribution**: `runtimeMode === 'desktop'` uses `HttpCoachService` (Ktor backend); `runtimeMode === 'web-*'` uses `WebWorkerCoachService` (in-browser workers).
- **Coach decoupling**: `useMoveExecutor` owns game mechanics and emits `lastHumanMoveInfo` / `lastAIMoveInfo` signals. `useCoachBehavior` reacts to those signals and owns all advice/emotion logic — do not add coach actions back into `useMoveExecutor`.
- **Capabilities pattern**: each screen sets `ScreenCapabilities` on mount (`capabilitiesStore`); hooks and components read specific flags rather than branching on a screen name.
- **Engine scheduling**: all main-thread Stockfish work goes through the `EnginePool` singleton (`engine/EnginePool.ts`) via `evaluate(req)` — never spawn a Stockfish `Worker` directly. Pick a priority (`interactive` for hint/hover and for the best-move arrow whenever it's shown, `normal` for the best-move arrow during live Coach play when the arrow is off, `background` for review/pre-analysis) so interactive searches preempt bulk work. See `_spec/chess-coach/ui/scheduler.puml`.
