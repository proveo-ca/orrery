# orrery

The coordinating root for **Proveo's agent projects** — a constellation of independent applications,
each attached as a Git submodule, orbiting a shared `_spec/` learning surface that maps how agent/LLM
systems are built.

> An orrery is a clockwork model of a system of orbiting bodies — the bodies *and* the map that places
> them, in one instrument you read and operate. This repo is that for Proveo: each `projects/*` is its
> own world; the root holds the map — the **capability ladder** and the sourced study-cases of the
> agentic field.

## What's here

- **`_spec/` — the learning surface.** A vendor-neutral, *sourced* map of the agent/LLM field: a
  7-level **capability ladder** (two views — a demand-side funnel and a build-side study map), plus
  **study-cases** of canonical techniques and products, each tied to a primary source.
- **`projects/` — the constellation.** Five independent apps, each a Git submodule tracking its own
  `main`. There is no root workspace and no cross-project task graph — `cd` in and use that project's
  own tooling.

## Layout

```
_spec/             Shared learning surface (the root owns this)
  overview/          The two ladder diagrams: business-needs-funnel.puml + study-map.vega.json → .svg
  study-cases/       The field, organized by capability level (3-meta-prompt-loops/ … 6-post-training/, _substrate/)
  themes/            Vendored proveo identity themes (Mermaid, Vega-Lite); PlantUML is remote-included
  CONTRIBUTING.md    Diagram + sourcing conventions
projects/          Independent applications, attached as Git submodules (see "Projects")
AGENTS.md          Team/agent workflow for working in this repo (mirrored as CLAUDE.md)
```

## The capability ladder

`_spec/` organizes the field by **at what level a business request should be solved** — from a human
baseline up to a custom-trained model. Full write-up in
[`_spec/study-cases/README.md`](_spec/study-cases/README.md); the two views:

| View | What it answers | Diagram |
| --- | --- | --- |
| **Demand-side funnel** | "which rung do we build/buy?" — business needs walk a request down from the aspirational top to the rung that clears the bar | [`business-needs-funnel.svg`](_spec/overview/business-needs-funnel.svg) |
| **Build-side study map** | "what do I go learn, and how do the tiers differ?" — the same tiers on a 2D plane: **encoding depth × autonomy** | [`study-map.svg`](_spec/overview/study-map.svg) |

## Projects

| Project | What it is |
| --- | --- |
| [`aphelion`](projects/aphelion) | Audit/evidence-based personal AI agent runtime (Go) — capability/effect authorization, a typed evidence ledger, face/governor privilege separation |
| [`omnigent`](projects/omnigent) | Vendor-neutral meta-harness — runs agents across Claude Code, Codex, Cursor, OpenCode… behind one executor protocol |
| [`chess-coach`](projects/chess-coach) | Multi-engine chess tutor — human-like Maia + optimal Stockfish + an LLM explainer; web + Android |
| [`nightfall`](projects/nightfall) | WebGL first-person horror game (React / Three.js) with reactive, FSM-driven AI |
| [`agents-of-empires`](projects/agents-of-empires) | LLM-driven RTS where agents compete for real host hardware (Docker containers as units) |

## Reference harnesses (external, public)

Trending third-party harnesses studied here — **not** Proveo code and **not** submodules; each maps to a study-case under `_spec/study-cases/4-harness/`.

| Harness | What it is | Repo | Study-case |
| --- | --- | --- | --- |
| **opencode** | Open-source terminal coding agent, multi-provider (MIT) | [sst/opencode](https://github.com/sst/opencode) · [opencode.ai](https://opencode.ai) | [`anti-framework/opencode.puml`](_spec/study-cases/4-harness/anti-framework/opencode.puml) |
| **browser-use** | Computer-use / web-automation harness (YC W25) | [browser-use/browser-use](https://github.com/browser-use/browser-use) · [browser-use.com](https://browser-use.com) | [`applied/computer-use/browser-use.puml`](_spec/study-cases/4-harness/applied/computer-use/browser-use.puml) |
| **Dify** | Visual agentic-workflow platform | [langgenius/dify](https://github.com/langgenius/dify) · [dify.ai](https://dify.ai) | [`framework/dify.puml`](_spec/study-cases/4-harness/framework/dify.puml) |

## Conventions

- **Each project is self-contained.** `cd projects/<name>` and use that project's own commands. No root
  `package.json`, no root workspace, no cross-project task graph.
- **The root owns `_spec/`** — the shared learning surface, *not* per-project specs (those live inside
  each submodule). Authoring follows [`_spec/CONTRIBUTING.md`](_spec/CONTRIBUTING.md): the proveo
  identity theme, role stereotypes, a `' Level:` header per file, and a confirmed source on every
  study-case.

## Submodules

Projects are Git submodules tracking their `main` branches; the root preserves the centralized `_spec/`
for cross-project architectural alignment.

```bash
git clone git@github.com:proveo-ca/orrery.git
cd orrery
git submodule update --init --recursive    # pull every project
git submodule update --remote --merge       # later: track each project's upstream main
```
