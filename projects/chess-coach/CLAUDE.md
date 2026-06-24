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
| `_spec/chess-coach/components.puml` | Full-stack architecture: UI ↔ Bun server (desktop) / in-browser workers (web); runtime modes (desktop / web-full / web-no-llm) |
| `_spec/chess-coach/ui/components.puml` | UI component graph: screens, hooks, stores, services, web-engine (no method bodies) |
| `_spec/chess-coach/ui/entities.puml` | Full API reference: all store selectors/mutations, hook contracts, service interfaces, engine methods |
| `_spec/chess-coach/ui/scheduler.puml` | EnginePool scheduler: workers, priority tiers + preemption, legacy-vs-pool differences |
| `_spec/chess-coach/sequence.puml` | Move, hint, and advice request flows (end-to-end) |
| `_spec/chess-coach/web-llm-integration.puml` | WebLLM model loading and Linux/WebGPU workaround |
| `_spec/chess-coach/architecture.puml` | Top-level system architecture |
| `_spec/chess-coach/multiplayer.puml` | Serverless LAN/online multiplayer: host-hub topology over Tailscale + WebRTC (no backend) |
| `_spec/chess-coach/multiplayer-sequence.puml` | Multiplayer flows: pairing handshake (QR/link), start gate, move relay, resign/disconnect |
| `_spec/chess-coach/distribution.md` | **Distribution architecture** (proposed): web / docker / desktop / Android mediums; CoachService port; Android embedded-server + P2P design; WebRTC-vs-Tailscale transport |
| `_spec/chess-coach/distribution.puml` | Android distribution topology: embedded thin server + WASM WebView + P2P (proposed) |
| `_spec/chess-coach/webrtc-p2p.puml` | P2P multiplayer signaling + move-exchange sequence (proposed) |
| `_spec/chess-coach/api/components.puml` | Bun server component breakdown (`apps/server`: routes, in-process orchestration, engine adapters, streaming) |
| `_spec/chess-coach/api/orchestration.puml` | Backend orchestration workflow end-to-end: move / advice / explain / hello |
| `_spec/chess-coach/api/behavior.md` | **Backend behavioral contract** — 100% of the Bun backend orchestration behavior (source of truth for web parity) |
| `_spec/chess-coach/api/ui-engine-parity.md` | Bun backend ⇄ `apps/ui/src/engine` parity map (prompt logic shared via `@chess-coach/engine-core`) |

## Key architecture notes

- **Dual distribution**: `runtimeMode === 'desktop'` uses `HttpCoachService` (the Bun server, `apps/server`); `runtimeMode === 'web-*'` uses `WebWorkerCoachService` (in-browser workers).
- **Shared orchestration core**: the behaviour-defining prompt / classification / commentary logic lives in `packages/engine-core` (`@chess-coach/engine-core`) and is imported by **both** the Bun server (`apps/server`) and the browser engine (`apps/ui/src/engine`) — one implementation, behavior pinned by `_spec/chess-coach/api/behavior.md`.
- **Coach decoupling**: `useMoveExecutor` owns game mechanics and emits `lastHumanMoveInfo` / `lastAIMoveInfo` signals. `useCoachBehavior` reacts to those signals and owns all advice/emotion logic — do not add coach actions back into `useMoveExecutor`.
- **Capabilities pattern**: each screen sets `ScreenCapabilities` on mount (`capabilitiesStore`); hooks and components read specific flags rather than branching on a screen name.
- **Engine scheduling**: all main-thread Stockfish work goes through the `EnginePool` singleton (`engine/EnginePool.ts`) via `evaluate(req)` — never spawn a Stockfish `Worker` directly. Pick a priority (`interactive` for hint/hover and for the best-move arrow whenever it's shown, `normal` for the best-move arrow during live Coach play when the arrow is off, `background` for review/pre-analysis) so interactive searches preempt bulk work. See `_spec/chess-coach/ui/scheduler.puml`.
