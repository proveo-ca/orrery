# PLAN — Inference Pulse: keeping `_spec/` true without a human reading 112 diagrams

**Status:** PLANNED · **Created:** 2026-09-01 · **Scope:** orrery root only (no `projects/*` changes)

A scheduled local-LLM job that keeps the learning surface honest and proposes its own corrections as
pull requests. Named for the existing [`pulse.json`](../../pulse.json) snapshot, which this extends
from a *static description* of the repo into a *recurring check* on it.

---

## 1. Why — the evidence, measured 2026-09-01

The repo has grown past the point where a human re-reads it. Today it holds **112 content `.puml`
files citing 107 distinct URLs** (40 arXiv, 11 DOI, **56 product/other**), plus 5 submodule pointers
and a vendored skill + themes.

A single manual audit session found five wrong claims, and **every one of them was invisible to a
naive link checker**:

| Found by hand | Cited URL returned | Reality |
| --- | --- | --- |
| Cohere **Coral** | 200 | Product name retired; the page now redirects to a login screen. Current equivalent: North |
| **Sweep** | 200 | Pivoted from GitHub issue→PR bot to a JetBrains IDE plugin |
| **Mentat** | (page unreachable) | AbanteAI marks the CLI *archived*; the name was reused by a different hosted product |
| **Continue** | 200 | Homepage states it "has joined Cursor" |
| **Hermes Agent "formerly OpenClaw"** | 200 | Not a rename — two live projects, one offering an import path from the other. The README claim was simply false |

So the interesting failure is **not** link rot. A full sweep of all 107 URLs found:

- **102 / 107 return 200.**
- **1 genuinely broken:** `http://www.erights.org/talks/thesis/markm-thesis.pdf` → HTTP 500 on three
  consecutive tries, then timeout; the whole of `erights.org` is down, root included. Cited by
  `4-harness/governance/capability-effect-authorization.puml`. **Remediated 2026-09-01** — repointed to
  the author-affiliated host (`papers.agoric.com`, verified to be the same JHU dissertation) plus a
  Wayback snapshot of the original URL, with a `' Formerly:` breadcrumb.
- **3 false positives:** 403 from `dl.acm.org`, `doi.org/10.1111/…`, `doi.org/10.1162/…` — publisher
  bot-gates. The resources exist. A status-only checker has a **~3% false-positive rate** on academic
  publishers, which is enough noise to train a reviewer to ignore the report.
- **5 silent redirect drifts**, of which **2 are real findings**:
  - `https://cohere.com/coral` ⇒ `https://dashboard.cohere.com/welcome/login` — the product page is
    gone (already carries a `' Status:` line marking Coral retired in favour of North)
  - `https://github.com/sst/opencode` ⇒ `https://github.com/anomalyco/opencode` — SST rebranded to
    Anomaly. **Remediated 2026-09-01** in both the README table and `anti-framework/opencode.puml`.
    Note `opencode.ai` remains canonical per the upstream README; `open-code.ai` is a third-party mirror
  - benign: `agentskills.io`→`/home`, `learn.microsoft.com`→locale-prefixed, `modelcontextprotocol.io`
    →versioned docs path

### The design consequence

Comparing `%{url_effective}` against the cited URL catches Coral and the opencode org move **with no
model at all** — both were found this way, by hand, in minutes. That reorders the whole architecture: put everything deterministic first, and reserve
inference for the residue that genuinely needs judgement — a page that returns 200, at the same URL,
whose *content* no longer matches what the diagram claims (Sweep, Mentat).

---

## 2. Three failure classes, three mechanisms

| Class | Example | Detected by | Model needed? |
| --- | --- | --- | --- |
| **Structural drift** | missing `' Level:`, level ≠ directory, broken cross-ref, stale `.svg` | `pulse-lint` | No |
| **Reference drift** | dead URL, redirect to a different org or a login page | `pulse-link` | No |
| **Subject drift** | URL fine, product pivoted / archived / renamed in place | `pulse-verify` | **Yes** |
| **Paradigm drift** | a new paper or product the taxonomy doesn't cover | `pulse-discover` | **Yes** |

Requirements map: **(1) vendored references** → `pulse-lint` + `pulse-link` + `pulse-verify`;
**(2) learning paradigms** → `pulse-discover`; **(3) PRs** → `pulse-pr`.

---

## 3. Components

### 3.1 `pulse-lint` — deterministic, no inference

Ten invariants, **every one of which corresponds to a defect found by hand this session**:

| # | Invariant | Regression it prevents |
| --- | --- | --- |
| 1 | `plantuml -checkonly` clean on every `.puml` | caught `note bottom of` in a sequence diagram |
| 2 | content file has `' Level:` **and** `' URL:`; metafiles exempt | 19 files missing `' Level:`; `mad.puml` fully sourceless |
| 3 | `' Level:` value agrees with its directory | an L3 file whose diagram drew a tool-executing harness |
| 4 | no `' Level:` / `' URL:` string inside prose | **corrupted a real `llms.txt` row this session** — `puml_meta` greps the token anywhere on a line |
| 5 | in-note cross-references resolve *from the containing file* | 8 paths missing `../` |
| 6 | every `.puml` has an `.svg` no older than it | a stale render is a lie in a file people read as truth |
| 7 | kebab-case filenames; leading `_` only for metafiles | 3 snake_case violations |
| 8 | `build-llm-context.sh` is idempotent (regenerate ⇒ empty diff) | **verified true today** — safe to assert, prevents spurious PR churn |
| 9 | `skills-lock.json` `computedHash` matches `skills/spec/` on disk | vendored skill drifting from its lock |
| 10 | submodule pointers vs their upstream `main` (report only, never auto-bump) | `chess-coach` demonstrably lags |

Runs in seconds, needs no GPU, and **should gate CI independently of the pulse** — this is the piece
worth building first even if inference never ships.

> Also worth fixing while here: `_spec/` has **no CI at all** (`.github/` does not exist), so none of
> these invariants is currently enforced on a PR. And note invariant 4 is a live trap, not a
> hypothetical: any prose mentioning the literal `' Level:` inside a `.puml` silently corrupts that
> file's `llms.txt` entry.

### 3.2 `pulse-link` — deterministic reference check

For each of the 107 cited URLs: record status **and** `url_effective`. Classify rather than alert:

- `404`/`410`/persistent `5xx` → **broken**, open an issue-shaped finding
- `403` from a known publisher bot-gate (`dl.acm.org`, `doi.org`, `direct.mit.edu`, `academic.oup.com`,
  `jstor.org`, `ieeexplore.ieee.org`, `projecteuclid.org`) → **suppress**; a DOI is a stable identifier
  and its liveness is not evidence of anything
- effective URL differs beyond an allowlist (`http→https`, trailing slash, locale prefix, `/home`,
  doc-version path) → **redirect drift**, the highest-precision signal available
- an `arxiv.org/abs/NNNN` that now advertises a newer version → note it; do not rewrite the citation
  (CONTRIBUTING §3: cite the dated version you read)
- **the citing file already carries a `' Status:` line → suppress.** A study-case explicitly marked as a
  dated snapshot (e.g. `framework/cohere-coral.puml`, kept as the Coral-era architecture) *should* have a
  drifting URL — that is what the `' Status:` header records. Re-flagging it every week is how a report
  earns its way into the ignore pile. Discovered by running this check post-remediation: it was the only
  remaining "real" drift, and it was already handled.

### 3.3 `pulse-verify` — inference, narrowly scoped

**The only job the model is trusted with on existing content**, and deliberately a *comparison*, not a
generation: given (a) a diagram's `title` + headers + note text, and (b) the fetched text of its cited
page, answer one schema-constrained question — *does the page still describe what the diagram claims?*

```json
{ "verdict": "matches" | "subject_changed" | "cannot_tell",
  "evidence_quote": "<= 200 chars, verbatim from the page",
  "what_changed": "<= 200 chars",
  "suggested_status_line": "' Status: ... | null" }
```

Rules that make this safe:

- **`evidence_quote` must appear verbatim in the fetched page** — checked programmatically, not by the
  model. A verdict whose quote fails this check is discarded. This is the single most important guard:
  it converts "the model claims X changed" into "here is the sentence that says so."
- **It may only propose a `' Status:` line** (the header added to CONTRIBUTING §1 this week). It may
  **never** rewrite a diagram body, retitle a file, or change a `' URL:`.
- `cannot_tell` is a first-class, non-penalised answer. Bot-gated and JS-only pages must land here.
- Budget: 56 product/other URLs, not all 107 — arXiv and DOI targets are immutable and skipped.

This is exactly the Sweep/Mentat/Continue class, and nothing wider.

### 3.4 `pulse-discover` — inference, gated hardest

Poll paper/product feeds, filter to the taxonomy, propose **new** study-cases.

- **Feeds:** arXiv API (`cs.AI`, `cs.CL`, `cs.LG`) is the primary — a documented API over stable
  identifiers. Secondary candidates (Hugging Face papers, Semantic Scholar API, alphaXiv) are
  **UNVERIFIED here** and should each be confirmed live, and for terms of use, before wiring in.
- **Output is a proposal, never a file:** `{ arxiv_id, title, proposed_level, proposed_path, why_this_level,
  nearest_existing_case, is_duplicate_of }`. A human authors the `.puml`; the pulse's job is to make
  sure nobody has to *notice* the paper.
- **Duplicate suppression is the hard part.** 112 existing cases already cover much of the field;
  precision matters more than recall, and a discover step that proposes three known things per week
  will be muted within a month. Start it **report-only** — no PR — until its precision is measured.
- The `' Level:` assignment is a judgement the ladder's own docs barely settle (see the L1
  two-natured amendment) — treat the model's `proposed_level` as a hint, never as authority.

### 3.5 `pulse-pr` — mechanical, no inference

Deterministic and boring on purpose. Never on `main`; one PR per pulse run; body is the findings
table with per-item provenance (URL, status, effective URL, evidence quote).

---

## 4. Platform support — Fedora + macOS

### Runner

**Ollama** is the recommendation, on two grounds that matter more than benchmark quality:

- It is **packaged in official Fedora repos** (`dnf install ollama`; present in F43–F45 and Rawhide,
  though the package lags upstream), and installs on macOS via script or Homebrew. MIT.
- Its **`format` parameter takes a real JSON Schema** and compiles it to a GBNF grammar to constrain
  decoding. Every component above depends on schema-valid output; prose would defeat the point.

`llama-cpp` is also officially Fedora-packaged (MIT, `127.0.0.1:8080`, `/v1/` routes) and is the
fallback. Two caveats to respect:

- llama.cpp has an **open bug** where the OpenAI-compat `/v1/chat/completions` path rejects
  `json_schema` and `grammar` together (`ggml-org/llama.cpp#11847`) — pin a version and smoke-test the
  exact call. Ollama's native `format` is the better-trodden path than either project's OpenAI shim.
- On macOS, Ollama is a **menu-bar app with no first-class pre-login daemon**; headless operation needs
  a hand-written `launchd` plist. Fine here — the pulse runs as a user agent anyway.

### Model

Start with **`gpt-oss:20b`** (Apache-2.0, ~21B MoE / 3.6B active, ~14GB download, runs in ~16GB, 128K
context, documented structured-output + function calling). Long-document passes can use
**`qwen3:30b`** for its 256K-context tag if RAM allows. `qwen3.6` and `gemma4` exist in Ollama's
library as of this research but their schema-constrained behaviour is **UNVERIFIED** — benchmark
before adopting.

Hardware reality: `pulse-lint` and `pulse-link` need none of this. Inference is only for §3.3/§3.4, so
a machine without the RAM can still run the deterministic pulse and skip the rest.

### Rung 0 — no harness, and why it is the right start

This is **rung 0 of the escalation ladder below** — the cheapest thing that could work, adopted as a
starting point rather than a principle. The model's work here is **two stateless classification calls**. `pulse-verify` compares a diagram's
claim against a fetched page; `pulse-discover` scores a feed entry against the taxonomy. Neither uses
tools, neither is multi-step, and — by §3.3's own rules — **the model never edits a file**. Applying a
proposed `' Status:` line is a deterministic script edit, not an agent action.

So the entire inference layer is one call, with the schema doing the enforcing:

```bash
curl -sS http://localhost:11434/api/generate -H 'Content-Type: application/json' -d '{
  "model": "gpt-oss:20b",
  "stream": false,
  "prompt": "<diagram claim> --- <fetched page text> --- Respond using JSON.",
  "format": { "type": "object",
              "properties": { "verdict": {"type":"string","enum":["matches","subject_changed","cannot_tell"]},
                              "evidence_quote": {"type":"string"},
                              "what_changed": {"type":"string"} },
              "required": ["verdict","evidence_quote"] }
}'
```

**Orrery's own funnel says to stop here.** The demand-side ladder exists to walk a request *down* to
the rung that clears the bar. A crafted prompt returning schema-valid JSON is **L2/L3**. An agent
harness is **L4** — tools, orchestration, authority. Reaching for one to keep 107 citations straight
would be exactly the over-provisioning `_spec/` was built to argue against. The plan should practice
what the repo preaches.

Dropping the harness also removes the single largest failure surface: no agent loop that can wander, no
harness upgrade that can change behaviour under a cron job, nothing to smoke-test but `curl` and `jq`.

### Escalation ladder — rung 0 is the starting point, not the destination

No-harness is the **starting** rung, chosen because it is the cheapest thing that could work — not
because agency is forbidden. Each rung below adds capability and subtracts determinism. **Climb only on
a named trigger, one rung at a time, and only after the rung below has been measured.**

| Rung | What it is | Added failure surface |
| --- | --- | --- |
| **0 — start** | `curl` → Ollama `format:<schema>` → `jq` → script apply → `gh` | none beyond two HTTP calls |
| **1** | Prompt/schema iteration; deterministic retry on schema-invalid or guard-failed output | none — same call, tried twice |
| **2** | A bounded fetch loop: the model may request **one** additional URL (e.g. a linked changelog), capped at 2 hops, allowlisted domains | a loop that can spend budget; needs a hop cap in code |
| **3** | A real harness (Hermes / opencode / omnigent) writing multi-file edits and iterating | an agent that can wander; upgrades change behaviour under cron |

### Escalation triggers — measurable, from the pulse's own reports

Every trigger is observable in `reports/` without new instrumentation, because the pulse already emits
per-item verdicts. Thresholds are starting values, to be revised once phase 3 has four weeks of data.

| # | Trigger (observed over ≥ 4 weekly runs) | Escalate to | What it buys |
| --- | --- | --- | --- |
| **T1** | `cannot_tell` > **25%** of verified URLs, and the sampled causes are *pages whose text is present but split across a linked changelog / release notes* | **Rung 2** | one extra hop reaches the page that actually states the change |
| **T2** | Confirmed `subject_changed` findings that the pulse **missed**, caught later by a human, > **2 per quarter** — i.e. false negatives, not noise | **Rung 2**, then reassess | more evidence per decision |
| **T3** | `pulse-discover` reaches measured precision ≥ **70%** at report-only, **and** the accepted proposals routinely need 3+ coordinated file edits (new `.puml` + `_primer.puml` row + README table + `llms.txt`) | **Rung 3** | multi-file authoring against review feedback — the one thing a harness genuinely does better |
| **T4** | The pulse is extended to a **second repo** (e.g. a `projects/*` spec surface) and the apply-step scripts have visibly diverged | **Rung 3**, likely [`omnigent`](../../projects/omnigent) | one executor protocol instead of N scripts |

**T3 is the only trigger that reaches rung 3**, and it is deliberately the hardest to satisfy: it
requires the generative step to already be *good* before it is given hands.

### Anti-triggers — symptoms that look like "we need an agent" and are not

The failure modes most likely to occur escalate along **other axes**. Writing them down because
reaching for a harness here would add nondeterminism and fix nothing:

| Symptom | Not a harness problem | Do this instead |
| --- | --- | --- |
| `cannot_tell` because pages are **JS-rendered or bot-gated** | a *fetching* problem | a headless-browser fetch step, or add the host to the §3.2 suppression list. Rung 0 unchanged |
| `pulse-discover` proposes things already covered by the 112 existing cases | a *retrieval* problem | embed the existing corpus and dedupe before prompting — this is `1-human-expert/rag/vector-dense-rag.puml`, not agency |
| Verdicts are confidently wrong, or `evidence_quote` fails the verbatim check | a *prompt or model* problem | rung 1: tighten the schema, add negative examples, or try a larger model. An agent loop would repeat the error with more steps |
| The run is slow | a *scheduling / batching* problem | shard the 56 product URLs across runs; raise the cadence |
| A finding needs several files touched **once** | a *scripting* problem | write the apply step; a one-off does not justify a permanent dependency |

**De-escalation is also a move.** If a rung stops paying for itself — rung 2's extra hop changes no
verdicts over a quarter — drop back down. Rungs are not ratchets.

### Candidates, when rung 3 arrives

Recorded because an earlier draft of this plan recommended **aider**, and that recommendation is
**withdrawn**: it is Apache-2.0 and not archived, but as of 2026-09-01 its last push was 2026-05-22
(~3½ months) at 48.6k stars, while both alternatives were pushed the day this was written, at 4–5× the
mindshare.

| Candidate | License | Last push | Stars | Shape | Fit for rung 3 |
| --- | --- | --- | --- | --- | --- |
| **Hermes Agent** | MIT | 2026-09-01 | ~239k | Self-improving personal agent; **built-in cron scheduler** with unattended "weekly audits" | Strong on capability; would also subsume §4's unit files |
| **opencode** | MIT | 2026-09-01 | ~203k | Terminal coding agent, multi-provider (moved `sst/` → `anomalyco/`) | Closest to "edit a repo headlessly"; verify headless reliability first |
| **omnigent** | — | — | — | Proveo's own vendor-neutral meta-harness | The T4 answer: one executor protocol across repos |
| aider | Apache-2.0 | 2026-05-22 | ~49k | Terminal pair-programming; auto-commits each edit | Withdrawn — least momentum of the three |

**Hermes is the strongest rung-3 candidate and the wrong rung-0 choice**, for reasons that are
properties of this job rather than of Hermes: schedules expressed "in natural language" are the wrong
contract for an invariant check that must fail deterministically; cross-session memory and
self-authored skills inject nondeterminism into a pipeline whose entire value is a reproducible audit
trail; and it installs a substantial runtime (its own Python/Node/uv, a bundled Git Bash, a
Telegram/Discord gateway, voice dependencies) to do what rung 0 does with two HTTP calls. Those
objections weaken considerably at rung 3, where multi-step agency is the actual requirement.

Note the symmetry: orrery already **studies** Hermes at
[`4-harness/self-improving/skill-library-flywheel.puml`](../study-cases/4-harness/self-improving/skill-library-flywheel.puml).
Climbing to rung 3 would make the repo an instance of a pattern it documents — which is a good reason
to do it deliberately, on a trigger, rather than by default.

### Scheduling — one script, two native units

No cross-platform scheduler daemon. `node-cron`/`APScheduler`/`pm2` would require re-implementing
persistence, wake-catch-up and boot-start — which is exactly what the OS schedulers already provide.

**Fedora** — systemd **user** timer in `~/.config/systemd/user/`:

```ini
# pulse.service
[Unit]
Description=orrery inference pulse
[Service]
Type=oneshot
ExecStart=%h/Projects/proveo/orrery/scripts/pulse/run.sh
```
```ini
# pulse.timer
[Timer]
OnCalendar=Mon 06:00:00
Persistent=true
[Install]
WantedBy=timers.target
```
`systemctl --user enable --now pulse.timer`. **`Persistent=true` re-fires a run the machine missed**
while off. A user timer only runs while the user has a session unless lingering is enabled:
`sudo loginctl enable-linger <user>` (which does not wake a sleeping machine — it only removes the
must-be-logged-in requirement).

**Do not use cron on Fedora:** `cronie` is not guaranteed installed (`rpm -q cronie`), and Fedora
steers toward timers. systemd is always present.

**macOS** — LaunchAgent in `~/Library/LaunchAgents/ai.proveo.orrery.pulse.plist` using
**`StartCalendarInterval`**, loaded with `launchctl bootstrap gui/$(id -u) <plist>` (`load` is
deprecated and exits 0 on a broken plist; `bootstrap` reports errors).

The `StartCalendarInterval` choice is load-bearing: if the Mac is **asleep**, launchd runs the job on
**wake**, coalescing missed firings. `StartInterval` does **not** catch up (since 10.11, a `kqueue`
limitation). Neither catches up across a full power-off.

**Do not use cron on macOS:** it is TCC-permission-fragile since Mojave and needs Full Disk Access
granted manually to the `cron` binary. (A report that macOS 15 added a toggle disabling cron entirely
is **UNCONFIRMED** against Apple docs — irrelevant if we use launchd.)

**Install:** one `scripts/pulse/install.sh` branching on `uname` writes and enables the right unit.
~30 lines, zero dependencies, auditable — which is all `routinely`/`opencode-scheduler` do internally.

---

## 5. The PR path and its rails

```bash
git switch -c pulse/$(date +%Y-%m-%d)
# ... pulse writes findings + any approved edits ...
git add -A && git commit -m "chore(pulse): ..."
git push -u origin HEAD
gh pr create --base main --title "..." --body-file reports/pulse-latest.md
```

- **Auth:** `GH_TOKEN` env var — the documented headless path, and it takes precedence over stored
  credentials. A fine-grained token scoped to *this repo only* needs **Contents: read/write** and
  **Pull requests: read/write**.
- **Identity:** prefer a **GitHub App** over a bot user — no seat cost, `[bot]`-suffixed audit trail,
  short-lived installation tokens instead of a long-lived PAT. One caveat found in research is that an
  App on a *personal-account* installation may be blocked from *creating* PRs; **orrery is org-owned
  (`proveo-ca/orrery`)**, where an App installation gets full collaborator-equivalent access, so this
  does not bite here.
- **Rails, in order of reliability:**
  1. **Branch protection on `main`** — require a PR before merging, and restrict who may push.
     Server-side, so it holds even if the script is buggy.
  2. **The script hard-refuses** to run any git write command while `HEAD` is `main`/`master`.
  3. A local `pre-push` hook as defence-in-depth only — `--no-verify` bypasses it, and hooks are not
     distributed with the repo.
- **Never auto-merge, never auto-bump submodules, and never let the model touch `' URL:` lines.** The
  pulse's authority stops at *proposing*.

---

## 6. Phasing

| Phase | Deliverable | Gate to proceed |
| --- | --- | --- |
| **0** | `scripts/pulse/lint.sh` (§3.1) + a `.github/` workflow running it on PRs | Passes clean on `main` today; fails on a deliberately broken fixture |
| **1** | `pulse-link` (§3.2) + `reports/pulse-latest.md`, run by hand | On `main` (108 cited URLs, measured post-remediation): **0** broken, **3** bot-gates suppressed, **4** redirect drifts of which 3 match the benign allowlist and 1 (`cohere.com/coral`) is suppressed by its `' Status:` line ⇒ **0 actionable findings**. And, replayed against `HEAD~1`, it must re-find the two citations remediated on 2026-09-01 — a checker that cannot rediscover a known past defect is not yet evidence of anything |
| **2** | Scheduling (§4) + `pulse-pr` (§5), still deterministic-only | A PR lands from a timer on both a Fedora and a macOS host |
| **3** | `pulse-verify` (§3.3) with the verbatim-quote guard | On the 4 known cases (Coral, Sweep, Mentat, Continue) it produces `subject_changed` with a quote that passes the check, and does **not** flag the ~50 healthy product URLs |
| **4** | `pulse-discover` (§3.4), report-only | Measured precision over 4 weeks before it is allowed to open a PR |
| **5** | **Escalation review** — re-set T1–T4 thresholds against four weeks of real reports; climb a rung only if a trigger fires | A written decision either way, recorded in this plan |

Phase 0 alone retires most of what this session did by hand. Phases 3–4 are the only ones that need a
GPU, a model, or trust. Phase 5 is not optional: thresholds set before any data exists are guesses, and
leaving them unreviewed is how a plan quietly becomes a rule.

---

## 7. Open decisions

1. **Ratify the escalation thresholds**, not the starting rung. Rung 0 (two `curl` calls + a script
   apply step) is settled; T1's 25% `cannot_tell`, T2's 2-per-quarter false negatives and T3's 70%
   discover precision are guesses until phase 3 has four weeks of data. They should be re-set from the
   first real reports rather than defended.
2. **Identity: GitHub App or a PAT** on the operator's own account for phase 2, upgrading later.
3. **Cadence:** weekly is the assumption above. arXiv volume in `cs.AI`/`cs.CL`/`cs.LG` may argue for
   daily discovery with weekly verification.
4. **Does the pulse write `pulse.json`?** It currently looks externally generated and its
   `spec_coverage.file_count` (135) is already stale. Folding it into phase 1 would give one honest,
   dated artifact instead of two.
5. **Should `_spec/themes/*` and `skills/spec/` be checked against their upstreams**, or is the
   `skills-lock.json` hash enough? Note the deeper exposure: **128 `.puml` files remote-`!include` the
   identity theme at render time**, so `raw.githubusercontent.com` is a hard dependency of every
   render — arguably the least-vendored "vendored reference" in the repo.

## 8. Non-goals

- Auto-merging anything, or bumping submodule pointers automatically.
- Letting the model author `.puml` bodies or edit citations. It proposes `' Status:` lines and new-case
  stubs; humans write diagrams.
- Rewriting a citation to a newer paper version — CONTRIBUTING §3 requires citing the dated version
  actually read.
- Replacing the review gates. The pulse produces a PR; `@adversarial-reviewer` and `@spec-keeper`
  still apply.

---

## Sources

Scheduling · [systemd.timer(5)](https://man.archlinux.org/man/systemd.timer.5) ·
[systemd.time(7)](https://man7.org/linux/man-pages/man7/systemd.time.7.html) ·
[Fedora Magazine — systemd timers](https://fedoramagazine.org/systemd-timers-for-scheduling-tasks/) ·
[Fedora Magazine — cron](https://fedoramagazine.org/scheduling-tasks-with-cron/) ·
[Apple — Scheduling Timed Jobs](https://developer.apple.com/library/archive/documentation/MacOSX/Conceptual/BPSystemStartup/Chapters/ScheduledJobs.html)

PRs · [gh pr create](https://cli.github.com/manual/gh_pr_create) ·
[gh help environment](https://cli.github.com/manual/gh_help_environment) ·
[GitHub — fine-grained tokens](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens) ·
[GitHub — protected branches](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)

Runners · [Ollama structured outputs](https://docs.ollama.com/capabilities/structured-outputs) ·
[Ollama API](https://github.com/ollama/ollama/blob/main/docs/api.md) ·
[Fedora package — ollama](https://packages.fedoraproject.org/pkgs/ollama/ollama/) ·
[Fedora package — llama-cpp](https://packages.fedoraproject.org/pkgs/llama-cpp/llama-cpp/) ·
[llama.cpp server](https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md) ·
[llama.cpp #11847](https://github.com/ggml-org/llama.cpp/issues/11847) ·
[gpt-oss](https://ollama.com/library/gpt-oss) · [qwen3](https://ollama.com/library/qwen3)

Harnesses *(evaluated, not adopted — see §4)* · [aider — git](https://aider.chat/docs/git.html) ·
[aider — OpenAI-compatible](https://aider.chat/docs/llms/openai-compat.html) ·
[opencode](https://github.com/anomalyco/opencode) ·
[OpenHands headless](https://docs.openhands.dev/usage/how-to/headless-mode) ·
[Continue](https://github.com/continuedev/continue)

Measurements in §1 were taken in-repo on 2026-09-01 (`curl` over all 107 cited URLs; `plantuml
-checkonly` over 128 `.puml`; `build-llm-context.sh` idempotency check).
