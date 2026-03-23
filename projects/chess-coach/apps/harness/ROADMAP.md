# Chess Coach Harness Roadmap

## Phase 1: Prompt Spec Compliance
The harness now uses spec-compliant structured prompts for both commentary and explanation paths.

### Completed
- [x] Centralized LLM and chess settings in `Config.kt`
- [x] Added structured prompt helpers in `LlmPromptFormat.kt`
- [x] Switched advice and explanation prompts to the documented model-card schema
- [x] Standardized CP formatting, including mate score mapping
- [x] Fixed explanation semantics so `MoveSAN` is always provided
- [x] Extracted `Commentary:` from structured model responses
- [x] Added unit tests for prompt formatting and orchestrator prompt semantics

## Phase 2: Output Consistency
The harness now normalizes streamed outputs to commentary-only text.

### Completed
- [x] Buffer stream responses and extract only `Commentary:` in streamed advice/explanation paths
- [x] Keep prompt generation aligned with the same `MoveAnalysis` helper path used by non-stream methods

## Phase 3: Remaining Polish

### Pending Steps
- [ ] 1. **Optional incremental stream parsing**
  - Replace buffered commentary-only stream handling with incremental `Commentary:` parsing if live streaming UX is needed in the harness.
- [ ] 2. **Harness output hardening parity**
  - Decide whether to port sanitizer and low-quality fallback logic from the UI if the harness will surface raw LLM outputs directly to users.
- [ ] 3. **Integration tests for real engine and prompt flow**
  - Add higher-level tests covering pre-move FEN semantics, `BestAlt`, and `CP` transitions with realistic engine outputs.
- [ ] 4. **Golden prompt fixtures**
  - Add shared fixture cases so harness and UI prompt builders remain aligned over time.
- [ ] 5. **Prompt/output contract documentation**
  - Document route- or command-level expectations for:
    - pre-move FEN
    - post-move FEN
    - SAN move identity
    - commentary-only output behavior
