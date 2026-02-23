# Agent Harness Summary: Architecture & Prompting

## 1. The Harness Dichotomy

Modern AI agents generally fall into one of two architectural patterns, depending on their target environment and performance requirements.

### The Anti-Framework Harness (Vertical Performance)
*   **Best For:** Deeply specialized tasks like Coding (Aider, OpenCode) or Creative Writing.
*   **Architecture:** A robust `while(true)` loop. It eschews complex graph abstractions for direct control over state transitions.
*   **Key Traits:**
    *   **Direct IO:** Uses raw PTY/Shell/File access rather than generic "Tools".
    *   **Stateful Memory:** Maintains strict objects for "Active Files" or "Current Plan".
    *   **Loop Control:** Hard-coded logic for token limits and iteration counts.
    *   **Easy Evals:** Leverages deterministic feedback (exit codes, linter errors) for reliable self-correction.

### The Framework-Based Harness (Horizontal Integration)
*   **Best For:** Enterprise operations, compliance, and multi-modal workflows (Microsoft Copilot, Glean).
*   **Architecture:** A stack of abstractions (RAG pipelines, Trust Boundaries, Model Gateways).
*   **Key Traits:**
    *   **Compliance:** Built-in "Trust Boundaries" for PII stripping and ACL checks.
    *   **Orchestration:** Uses standard protocols (like LangGraph or Semantic Kernel) to coordinate multiple specialized agents.
    *   **Abstraction:** Normalizes 100+ SaaS APIs into a uniform interface.

## 2. Cognitive Architectures (The Brain)

While the Harness manages the *flow*, the Prompting Architecture manages the *reasoning*.

*   **ReAct (Reason + Act):** The industry standard for tool use. The model must "Think" before it "Acts", and observe the result before continuing. This loop corrects course dynamically.
*   **Plan-and-Solve:** Separates "Architecting" from "Building". A Planner agent defines the steps upfront, and an Executor agent blindly follows them. Essential for preventing rabbit holes in complex tasks.
*   **Reflexion:** A self-healing loop. The agent attempts a task, evaluates failure, writes a "lesson learned" to memory, and retries. This mimics human learning.

## 3. Context Engineering (The Fuel)

Managing the Context Window is the hardest engineering challenge. It is not just about "fitting more in"; it is about **Context Steering**.

### Ingestion vs. Selection
*   **Tree-sitter (Structure):** Used by coding agents (Aider) to understand the *skeleton* of code (classes, functions) without reading every line.
*   **Vector Search (Semantics):** Used by enterprise search (Glean) to find relevant documents based on meaning.

### Context Steering & Pruning
*   **The Problem:** Large context windows (1M+ tokens) suffer from "Lost in the Middle" phenomena and high latency.
*   **The Solution (Pruning):**
    *   **Sliding Window:** Keep the last $N$ turns raw, summarize the rest.
    *   **Active Set:** Explicitly track which files/docs are "Open" and prune everything else.
    *   **Relevance Ranking:** Use PageRank (graph analysis) to determine which files are actually important to the current problem, discarding 90% of the codebase to focus on the critical 10%.

### High-Precision Context (Finance/Legal)
For domains requiring 100% accuracy, standard chunking fails.
*   **Proposition Retrieval:** Instead of retrieving paragraphs, retrieve atomic "facts" (propositions). See *Dense X Retrieval* (https://arxiv.org/abs/2312.06648).
*   **Chain-of-Verification (CoVe):** The model must generate a verification plan against the context before answering. See *CoVe* (https://arxiv.org/abs/2309.11495).

## 4. Evaluation & Verification (The Guardrails)

Trust is the currency of agents. Whether controlling a character in a game or making a business decision, harnesses must implement "Run-Time Evals" to measure confidence before acting.

### Verification Strategies
*   **Deterministic vs. Probabilistic:**
    *   **Anti-Framework (Deterministic):** "Did the test pass?" The harness checks the exit code. This is why coding agents are more autonomous; they have a ground-truth signal.
    *   **Framework (Probabilistic):** "Is this answer polite?" The harness must use a secondary LLM (Evaluator) or human feedback to judge quality, which is slower and less reliable.
*   **Run-Time Confidence:**
    *   **Logprobs/Entropy:** Monitoring the raw probability of the model's choices. High entropy (uncertainty) during a critical decision (e.g., "Attack" vs "Defend") should trigger a fallback or user confirmation.
    *   **Self-Critique:** A secondary loop where the model asks, "Does this action align with my current goal/persona?" (See *Reflexion*).
*   **Verified Sources (Grounding):**
    *   **Framework Approach:** Systems enforce "Citation". Every claim or decision must link back to a retrieved fact or rule. If the similarity score is low, the harness flags the action as "Low Confidence".
    *   **Simulation/Prediction:** In decision-making or games, the harness can simulate the outcome (e.g., "If I move here, will I die?") before committing the action.

### Evals (Offline vs. Online)
*   **Offline Evals (Benchmarks):** Running the agent against a static dataset of known scenarios (e.g., "Scenario A: accurate diagnosis", "Scenario B: correct pathfinding") to measure success rates.
*   **Online Evals (Feedback):** Tracking "User Acceptance Rate" or "Reward Signals" (e.g., did the user accept the suggestion? Did the game score increase?).

## 5. Interaction Patterns (The Collaboration)

An agent is not a "fire and forget" missile; it is a collaborator. The harness must support patterns that allow humans to steer, interrupt, and approve actions.

### Human-in-the-Loop Strategies
*   **Permission Gates:**
    *   **Crucial for Safety:** High-risk tools (e.g., `delete_file`, `deploy_prod`) should be flagged as "RequiresApproval". The harness pauses the loop and waits for a user `y/n` signal before executing.
    *   **Silent vs. Loud:** Read-only tools (search, grep) run silently. Write tools run loudly.
*   **Interruptibility:**
    *   **The "Stop" Button:** Users must be able to halt a runaway loop or infinite reasoning chain immediately.
    *   **Injection:** Users should be able to inject new context mid-task ("Wait, I forgot to mention, use the V2 API") without restarting the entire session.
*   **Clarification Loops:**
    *   **Ambiguity Detection:** If a user request is vague ("Fix the bug"), the agent should be prompted to ask clarifying questions ("Which bug? Can you paste the error?") instead of guessing.

## 6. Applied Examples: Mapping Theory to Tools

### Anti-Framework Implementations
*   **Aider (Code):**
    *   *Eval:* **Linter-First.** It runs code analysis *before* showing the user.
    *   *Interaction:* **Commit-Review.** The "Accept" button is a Git Commit.
*   **Sweep (Async):**
    *   *Eval:* **CI/CD.** Relies on external GitHub Actions to verify correctness.
    *   *Interaction:* **Comment-Driven.** Uses issue comments for feedback loops.

### Framework Implementations
*   **Microsoft Copilot:**
    *   *Eval:* **Trust Boundary.** A rigid compliance layer that filters output before the user sees it.
    *   *Interaction:* **App-Host.** Uses "Ghost Text" (Tab-to-complete) as a low-friction permission gate.
*   **Typeface (Marketing):**
    *   *Eval:* **Brand Guard.** A specialized model checks style guidelines.
    *   *Interaction:* **Rich UI.** Uses sliders and templates to constrain the model's freedom *before* prompting.

## 7. Conclusion: The Modern Stack

The future likely isn't "Framework vs Anti-Framework", but a hybrid structure:

1.  **Inner Loop (The Agent):** Uses an **Anti-Framework** architecture (ReAct/While Loop) for maximum vertical performance, deterministic evals, and tool mastery.
2.  **Outer Scope (The Environment):** Encased in a **Framework** layer (LangGraph/Semantic Kernel) to handle horizontal concerns like RBAC, Auth, and Compliance.
3.  **The Interface (The Gate):** Controlled by a **Tight User Gate** (App-Host/Confirmation) to ensure that the autonomous inner loop doesn't violate the safety constraints of the outer scope.
