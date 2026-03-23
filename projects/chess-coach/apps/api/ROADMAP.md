# Chess Coach API Roadmap

## Phase 1: Harness Integration Compatibility
The API is currently compatible with the harness prompt-compliance refactor.

### Current Status
- [x] `/move` remains compatible with harness move execution
- [x] `/explain` already passes `fenBefore`, `fenAfter`, `isBlunder`, and `moveSan`
- [x] `/new` and `/hello` do not require follow-up changes from the harness prompt migration
- [x] No immediate API code changes are required for the completed harness prompt-spec work

## Phase 2: Semantic API Hardening
The main remaining work is to ensure the API request/response contracts stay aligned with stricter prompt semantics and future harness evolution.

### Pending Steps
- [ ] 1. **Audit `/advice` request semantics**
  - Confirm whether the current `AdviceRequest(humanMove, aiMove, fen)` always supplies enough context for spec-compliant prompt construction.
  - Verify whether `fen` is consistently the pre-move position for the move being analyzed.
- [ ] 2. **Consider richer `/advice` request shape**
  - If needed, expand `/advice` to pass more explicit move-analysis context such as:
    - `fenBefore`
    - `fenAfter`
    - `moveSan`
    - optional classification context
  - Keep this aligned with harness/web structured prompt semantics.
- [ ] 3. **Daemon protocol compatibility audit**
  - Re-check `DaemonRequest` / `DaemonResponse` fields if the harness daemon command surface changes again.
  - Ensure API-side `HarnessInvoker` stays aligned with any future non-stream explanation or commentary changes.
- [ ] 4. **API integration tests for semantic parity**
  - Add or extend tests to verify that `/advice` and `/explain` remain compatible with the harness contract and expected prompt semantics.
- [ ] 5. **Document route-level invariants**
  - Clarify in API docs or code comments which FEN each route expects:
    - `/move` expects post-human-move FEN
    - `/explain` expects pre-move and post-move FEN
    - `/advice` should explicitly document whether `fen` is pre-move, post-move, or contextual
