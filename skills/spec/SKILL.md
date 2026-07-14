---
name: spec
description: >-
  Conventions and rendering for proveo architecture/spec diagrams. Use this skill
  whenever working under a `_spec/` directory; authoring or editing PlantUML (`.puml`),
  Mermaid (`.mmd`/`.mermaid`), or Vega-Lite (`.vega.json`) diagrams; adding or maintaining
  `// SPEC:` / `# SPEC:` source references; or when the user asks about proveo diagram
  conventions, the proveo identity color palette/theme, role stereotypes, semantic arrows,
  or how to validate and render diagrams. Covers hybrid theme delivery (remote PlantUML
  include + vendored Mermaid/Vega themes in `_spec/themes/`), the SPEC reference lifecycle,
  and native rendering with `plantuml`, `mmdc`, and `vl2svg`.
version: 1.0.0
license: MIT
---

# spec

Author and render the diagrams that document a proveo codebase. Specifications live under a
project's `_spec/` directory and are linked from the code they describe via `SPEC:` comments,
so a reader can jump from a source file to the diagram of how it works — and so diagrams are
caught when the code they describe changes.

Three diagram formats share one identity (the proveo palette + role semantics):

| Format | Extension | Reach for it when |
| --- | --- | --- |
| **PlantUML** | `.puml` | Architecture, component, deployment, sequence, and state diagrams. The default — and the only format that has no native renderer, so it must be rendered/validated explicitly. |
| **Mermaid** | `.mmd` | Lightweight flow/state/topology diagrams that should render inline in GitHub, IDEs, and Markdown without a build step. |
| **Vega-Lite** | `.vega.json` | Data charts (bars, lines, heatmaps) — metrics, distributions, anything quantitative. |

This skill is the entry point. Depth lives in `references/` — load the file for the format you're
working in rather than reading everything:

- `references/plantuml.md` — full PlantUML conventions: stereotypes, arrows, Creole text, layout, validation gotchas.
- `references/mermaid.md` — Mermaid theming and role classes.
- `references/vega-lite.md` — Vega-Lite config theming and color ranges.
- `references/rendering.md` — install + validate + render commands for all three.

## The identity (applies to all three formats)

One palette, six semantic **roles**. Tag a node by role; the color follows. Intent on edges is
carried by line **style** (bold/dotted/dashed) as well as color, so it survives greyscale and
color-blind viewing.

| Role | Meaning | Color |
| --- | --- | --- |
| `app` | first-party app / runtime service | `#005F7F` teal |
| `async` | queue / event-driven / background | `#CBDB2A` lime |
| `host` | host / platform / operator boundary | `#00BAC6` cyan |
| `cloud` | external / third-party / vendor | `#585858` slate |
| `db` | persistence / state store | `#E5E4E4` light |
| `error` | failure / destructive / dangerous | `#CB2000` red |

In PlantUML these are `<<app>>` … `<<error>>` stereotypes; in Mermaid they are `:::app` … `:::error`
class names; in Vega-Lite they are the ordered `category` range. Same colors, same names everywhere.

## Theme delivery — hybrid

PlantUML can pull its theme over the network; Mermaid and Vega-Lite cannot, so they are **vendored**
into the consuming project's `_spec/themes/`. Run this once per project (or whenever you add the first
Mermaid/Vega diagram):

```bash
# from the project root — copies proveo.mermaid + the two vega configs into ./_spec/themes/
bash <path-to-skill>/scripts/fetch-themes.sh
```

Then:

- **PlantUML** — include the theme remotely (auto-tracks the upstream palette):
  ```puml
  !include https://raw.githubusercontent.com/proveo-ca/identity/main/proveo.puml
  ' dark canvas: proveo-dark.puml
  ```
- **Mermaid** — prepend the `%%{init}%%` block from `_spec/themes/proveo.mermaid` to each `.mmd`.
- **Vega-Lite** — set the spec's `"config"` to the contents of `_spec/themes/proveo.vega.json`
  (or `proveo-dark.vega.json`).

## Authoring workflow

1. **Pick the format** using the table above (PlantUML unless it's inline-rendered flow → Mermaid, or data → Vega-Lite).
2. **Apply the theme** per the hybrid rules above.
3. **Tag nodes by role** (`<<app>>` / `:::app` / category) and **choose arrows by intent**, not decoration.
4. **Name things explicitly** — `apps/api Session Routes`, not `Backend`. Prefer current-state truth; keep future direction in notes.
5. **Reference the diagram from code** — every new `.puml` MUST be linked from at least one source file (see SPEC lifecycle below). Mermaid/Vega that render inline in docs are exempt.
6. **Validate and render** — see `references/rendering.md`. For PlantUML always run `plantuml -checkonly` before committing.

### PlantUML quick form

```puml
@startuml
!include https://raw.githubusercontent.com/proveo-ca/identity/main/proveo.puml
component "apps/api Gateway" as API <<app>>
queue     "Event Bus"        as BUS <<async>>
database  "Postgres"         as PG  <<db>>
cloud     "LLM Vendor"       as LLM <<cloud>>

API ARROW_QUEUE BUS : enqueue
API ARROW_CLOUD LLM : call model
API ARROW_MAIN  PG  : persist
API ARROW_ERROR PG  : on failure
@enduml
```

Arrow macros: `ARROW_MAIN` (primary/sync happy path), `ARROW_OPTIONAL` (alt/retry/resume, dotted),
`ARROW_QUEUE` (internal async hand-off, lime), `ARROW_CLOUD` (crosses to an external system, dashed),
`ARROW_ERROR` (failure/cancel, red). One macro per edge, chosen by intent. Full detail in `references/plantuml.md`.

> Legacy diagrams use `!includeurl …/proveo.iuml` with `COLOR_MAIN` / `PATH_MAIN` / `errorLabel()` macros.
> Those macros still resolve as aliases inside `proveo.puml`, so old files keep working — but author **new**
> diagrams with the stereotype + `ARROW_*` system above.

## SPEC reference lifecycle (the rules that keep diagrams honest)

Source files link to their spec on a single top-line comment; multiple diagrams are comma-separated on one line:

```ts
// SPEC: _spec/apps/web/model-grid/row-loading-lifecycle.puml
```
```sh
# SPEC: _spec/defs/claudecode/claudecode-topology.puml, _spec/defs/claudecode/claudecode-egress-topology.puml
```

- **Every new `.puml` must be referenced** from at least one source file. If the natural source is generated, attach the reference to the upstream definition (schema/config) that drives the generator. Cross-cutting invariants attach to every file that enforces them.
- **Source deleted/renamed** → don't delete the `.puml`; move the `SPEC:` comment to the file(s) that replaced the behavior.
- **Only delete a `.puml`** when the whole feature is gone. If a feature was reimplemented on different tech, mark the diagram `OUTDATED` rather than deleting it.
- **Refactor moves logic** → move the `SPEC:` comment and update the diagram if the architecture changed.
- `_spec/_refactors/` holds frozen historical snapshots — exempt from referencing, and don't lint/validate them against current code.

## Out of the box

Render and validate locally:

- PlantUML — `brew install plantuml`; `plantuml -checkonly f.puml`; `plantuml -tsvg f.puml`.
- Mermaid — `npm i -g @mermaid-js/mermaid-cli`; `mmdc -i f.mmd -o f.svg`.
- Vega-Lite — `npm i -g vega-cli vega-lite`; `vl2svg f.vega.json f.svg`.

See `references/rendering.md` for flags, dark-mode, headless-Chromium notes, and CI usage.
