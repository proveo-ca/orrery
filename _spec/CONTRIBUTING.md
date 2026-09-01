# Contributing to `_spec/` — the study-cases learning surface

This `_spec/` tree is the harness's **shared learning surface**: a curated, sourced map of how
agent/LLM systems are built — reasoning architectures, harness shapes, governance models, deployment
patterns — distilled into diagrams. It is *not* coupled to any one project's code; it documents the
**field**, and our own `projects/*` are treated as reference implementations of patterns that also
exist in the literature.

Authoring and rendering follow the **`spec` skill** (`skills/spec/`, also linked from
`.agents/skills/spec/`): proveo identity theme, six `<<role>>` stereotypes, intent-carrying `ARROW_*`
macros, explicit naming, current-state truth, and `plantuml -checkonly` before commit. Install into
another checkout with `npx skills add proveo-ca/orrery --skill spec`. Read it first. This file adds
the rules that are specific to the **study-cases** surface — chiefly: **every file is sourced.**

After adding or renaming study-case sources, regenerate the scraper index and digest from the repo
root: `bash scripts/build-llm-context.sh` (updates `llms.txt` and `llms-full.txt`). Verify with
`bash scripts/test-build-llm-context.sh`.

---

## 1. The sourcing rule — never sourceless, arXiv is *conditional*

> **Every study-case file MUST carry a citation to its primary source.** A diagram with no source is
> incomplete and must not be committed. Confirm the identifier against the real abstract/venue page —
> we do not cite from memory.

The *kind* of source is **conditional on what the file documents**. arXiv is the preferred source —
**but only when the file documents a published research method.** Otherwise the canonical source for
that kind of artifact supersedes arXiv:

| If the file documents… | Cite | Example |
| --- | --- | --- |
| a **research method / technique** (reasoning architecture, retrieval/verification strategy, learning algorithm) | **arXiv abstract URL** — `https://arxiv.org/abs/XXXX.XXXXX` | `arXiv:2210.03629` (ReAct) |
| a method published **only in a venue with no arXiv** (Science, SOSP, CACM, KDD…) | the **DOI / venue page** | CICERO → `science.org/doi/10.1126/science.ade9097` |
| a **shipping product / tool / framework** | the **canonical product or repo URL** | `https://aider.chat/`, GitHub repo |
| a **protocol / standard / RFC** | the **official spec page** | MCP → `modelcontextprotocol.io`; PROV → `w3.org/TR/prov-overview/` |
| a **foundational CS concept** (capability security, leases, sagas, event sourcing) | the **canonical paper / author page** (usually pre-arXiv — cite DOI or author site) | Saltzer & Schroeder → `web.mit.edu/Saltzer/...` |

So: **arXiv when it's a paper that's on arXiv; the canonical artifact source otherwise; always
something.** Don't force a product into an arXiv citation, and don't downgrade a real paper to a blog
link.

### Header form

Place the source at the top of the file, right after the theme `!include`, by the `title`. This is the
established convention (see `study-cases/3-meta-prompt-loops/react.puml`):

```puml
@startuml
!include https://raw.githubusercontent.com/proveo-ca/identity/main/proveo.puml
title ReAct Architecture (Reason + Act)
' Paper:  ReAct: Synergizing Reasoning and Acting in Language Models
' URL:    https://arxiv.org/abs/2210.03629
' Level:  3
```

- `' Paper:` — the title line. Use it for research-method files; omit for bare product/standard files.
- `' URL:` — **required on every content file.** The arXiv/DOI/product/spec link per the table above.
  Metafiles (leading `_`, e.g. `_primer.puml`) and `README.md` are exempt — see §3.
- `' Level:` — **required on every content file.** The capability-ladder tier `1`–`7`, or
  `n/a (substrate)` — see [`study-cases/README.md`](./study-cases/README.md). The file's directory must
  agree (e.g. a file in `4-harness/governance/` declares `Level: 4`). A metafile spanning tiers may
  omit it.
- `' Formerly:` — the file's previous path and/or the subject's previous name, after a rename or fold
  (see §3, "Renames and folds").
- `' Status:` — **required when the subject is no longer current**: a product renamed, archived,
  pivoted or discontinued, or an architecture that is now a dated snapshot. State the date you
  checked, what changed, and the current equivalent. Pair it with `OUTDATED` in the `title` when the
  whole diagram is historical (see `4-harness/framework/cohere-coral.puml`).
- Optional, and used where they earn their place: `' Synthesis:` (what a primer distills),
  `' Source:` (an upstream repo a primer was distilled from), `' Note:` (a caveat a reader needs
  before trusting the diagram), `' Concept:` / `' Context:` (framing for a pattern with no single
  canonical paper).
- Products use `' URL:` alone (see `study-cases/4-harness/anti-framework/aider.puml`).
- In Markdown study-cases, use the per-entry `*Abstract:* … *URL:* …` form (see
  `study-cases/context-and-retrieval.md`).

### Provenance — tie abstract patterns back to our reference implementations

When a study-case **generalizes a pattern we actually built** in `projects/*`, add a provenance line.
It is **additive** — it never replaces the external citation:

```puml
' Provenance: projects/aphelion · effectauth/effectauth.go (capability/effect authorization)
```

### Multiple or competing sources

List the **primary first**, then alternates — comma-separated or one `' URL:` per line. (E.g.
multi-agent debate has two canonical papers, Du et al. `arXiv:2305.14325` and Liang et al.
`arXiv:2305.19118`; cite the one your diagram models, note the other.)

---

## 2. Study-cases *invert* the SPEC back-reference rule

The `spec` skill requires every project `.puml` to be linked from a source file via a `// SPEC:`
comment, so diagrams stay honest when code changes. **Study-cases are exempt from that rule** — they
describe the field, not our repo, so there is usually no source file to anchor them to.

Instead, the **external citation is the anchor** (plus optional provenance). The honesty invariant is
preserved, just inverted:

- **Project specs point _into_ the repo** (a `SPEC:` comment on the code they describe).
- **Study-cases point _out_ to the literature** (the `' URL:` source they distill).

A study-case with neither a citation nor provenance is the study-case equivalent of an unreferenced
project diagram: it doesn't belong.

---

## 3. Other good practices

- **Format choice** (per the skill): PlantUML `.puml` is the default (architecture/sequence/state);
  Mermaid `.mmd` for flow that should render inline in Markdown; Vega-Lite `.vega.json` for data
  charts. Most study-cases are PlantUML.
- **Theme & identity:** new files `!include …/proveo.puml` and tag nodes with `<<role>>` stereotypes +
  `ARROW_*` macros chosen by intent. Legacy study-cases still use `!includeurl …/proveo.iuml` with the
  old `COLOR_*`/`PATH_*` macros — **leave them as-is; modernize only a file you're already editing.**
- **Organize by level (then topic).** The tree is **level-first**: top-level `N-name/` dirs
  (`1-human-expert/`, `2-single-prompts/`, `3-meta-prompt-loops/`, `4-harness/`, `5-fine-tuned/`,
  `6-post-training/`), with topic subfolders inside `1-human-expert/` (`computer-science/`,
  `machine-learning/`, `rag/`),
  `2-single-prompts/` (`discovery/`), and the large `4-harness/` tier (`governance/`,
  `meta-orchestration/`, `self-improving/`, `applied/`, …). A self-improving system with **frozen
  weights** is an L4 self-improving harness; one that **updates weights** against a reward/eval loop
  is L6 post-training (above L5 supervised fine-tuning, which adapts to a fixed dataset). Substrate
  that's orthogonal to the ladder lives under `_substrate/`. The capability ladder and the full level
  map are in [`study-cases/README.md`](./study-cases/README.md).
- **`_plans/` is not a study-case directory.** `_spec/_plans/*.md` holds forward-looking
  implementation plans for the learning surface itself (tooling, automation, ladder amendments). They
  are Markdown, carry no `' Level:` / `' URL:` headers, and are deliberately outside the `.puml`
  conventions below and outside the generated `llms.txt` index. A plan describes work not yet done —
  so unlike a study-case, it is *expected* to go stale, and should be deleted or marked `DONE` once
  its phases land.
- **One concept per file.** Give each topic subfolder a `_primer.puml` that summarizes it (see
  `4-harness/anti-framework/_primer.puml`). Cross-cutting narrative goes in a root-level `.md`
  (`summary.md`, `context-and-retrieval.md`).
- **Leading-underscore files are metafiles.** A filename starting with `_` — canonically
  `_primer.puml` — is an index for reading convenience, not a study-case: it synthesizes its
  already-sourced siblings so a reader can get oriented in one file. Metafiles are **source-exempt**
  (no `' URL:` of their own) and need no `' Level:` when they span tiers; a single-tier primer may
  still declare one. `README.md` is exempt on the same grounds. The no-sourceless rule in §1 applies
  to *content* study-cases.

  > **A metafile is never a citation anchor.** A primer may *name* methods it has no content file for
  > — that is what makes it a useful selection map. What it may not do is serve as the **target** of a
  > citation: never point a reader at a primer for a source (that inverts §2), and never let a
  > cross-reference promise a discussion the target file does not contain. When a named method starts
  > carrying real weight — someone would cite it — promote it to its own content file with a `' URL:`.

- **Renames and folds — leave a breadcrumb.** The staleness rule below covers a *superseded*
  study-case; this one covers a *moved* one, so a later reader can still find what a citation used to
  point at. Two cases, deliberately different:
  - **An individual file or folder moves** (a fold, a retitle, a subject that changed name): add a
    `' Formerly:` header to each moved file naming its old path and old subject name, **and** record
    the move in the affected `README.md`.
  - **A repo-wide convention rename** (e.g. every `_essentials.puml` → `_primer.puml`): record it
    **once**, here and in `study-cases/README.md`. Per-file breadcrumbs on a mechanical sweep are
    noise, and git already carries the rename.
- **Naming:** kebab-case filenames; explicit node names (`apps/api Session Routes`, not `Backend`).
- **Validate before commit:** `plantuml -checkonly file.puml` (empty output + exit 0 = clean).
- **Staleness — append, don't silently rewrite.** Study-cases drift as the field moves. Cite the
  dated paper version you read. When a study-case is superseded, add a note or mark it `OUTDATED`
  rather than deleting it or quietly editing the architecture out from under the citation. (Mirrors
  the skill's diagram lifecycle.)

---

## 4. Author checklist

Before committing a new study-case:

- [ ] One concept, in the right **level** directory (`N-name/…`), kebab-case filename.
- [ ] **`' Level:` header present** and matching the directory (metafiles spanning tiers may omit it).
- [ ] Cross-references in notes resolve **from the containing file** — sibling folders need `../`.
- [ ] Theme included; nodes tagged by `<<role>>`; arrows chosen by intent (`ARROW_*`).
- [ ] **`' URL:` source present** and verified against the real abstract/venue/product page.
- [ ] Source *kind* matches the conditional table in §1 (arXiv only for on-arXiv research methods).
- [ ] `' Provenance:` line added if it generalizes a `projects/*` pattern.
- [ ] `plantuml -checkonly` passes.

---

## 5. The study-cases are authored

The original sourced backlog (`TODO.md`) has been **fully consumed** — every suggested study-case is
now an authored, rendered `.puml` under `study-cases/<level>/…` (see
[`study-cases/README.md`](./study-cases/README.md) for the level map). Add new study-cases directly in
the right level dir, following the rules above: one concept per file, `' Level:` + `' URL:` headers, a
confirmed source, and `plantuml -checkonly` clean.
