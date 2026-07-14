# PlantUML conventions (proveo)

PlantUML is the default spec format: architecture, component, deployment, sequence, and state
diagrams. Specs optimize for **architectural communication**, **current-state accuracy**, **visual
consistency**, and **separation of critical vs secondary paths**.

## Theme include

Pull the identity theme remotely — it's the single source of truth for color across every proveo
project, so changing it upstream updates every diagram:

```puml
@startuml
!include https://raw.githubusercontent.com/proveo-ca/identity/main/proveo.puml
' dark canvas (same macros, same role colors):
' !include https://raw.githubusercontent.com/proveo-ca/identity/main/proveo-dark.puml
```

Diagram-specific settings (`skinparam linetype polyline`, `!pragma layout smetana`,
`skinparam defaultFontSize 11`, …) go after the `!include` in the individual file.

> **Legacy.** Older diagrams use `!includeurl …/proveo.iuml` with `COLOR_MAIN` / `PATH_MAIN` /
> `errorLabel()` macros. Those macros are kept as aliases inside `proveo.puml`, so legacy files keep
> rendering — but author **new** diagrams with the stereotype + `ARROW_*` system below.

## Roles via stereotypes

Color is **semantic**, driven by six roles. Pick the PlantUML **keyword** for the shape/semantics,
then tag the node with the matching `<<role>>` **stereotype** for its canonical color. The stereotype
sets the fill across `\n` line breaks (inline `<color:..>` Creole does not), reads as intent at the
use site, and restyles from one place.

| Stereotype | Use for | Color |
| --- | --- | --- |
| `<<app>>` | first-party application / runtime service (web, API, worker, orchestrator) | `#005F7F` teal |
| `<<async>>` | queue / event bus / scheduler / background / eventual-consistency boundary | `#CBDB2A` lime |
| `<<host>>` | host machine / platform boundary / operator-controlled runtime | `#00BAC6` cyan |
| `<<cloud>>` | external SaaS / vendor API / third-party auth or messaging / cloud platform | `#585858` slate |
| `<<db>>` | relational schema / cache / object store / state store | `#E5E4E4` light |
| `<<error>>` | destructive / failure / dangerous / security-sensitive component | `#CB2000` red |

### Keyword → role pairing

Choose the keyword that matches the role; add the stereotype for the color:

```puml
component "apps/web Dashboard" as WEB <<app>>
component "apps/api Gateway"   as API <<app>>
queue     "Event Bus"          as BUS <<async>>
node      "Operator Host"      as HOST <<host>>
database  "Postgres"           as PG  <<db>>
cloud     "LLM Vendor"         as LLM <<cloud>>
component "Dead Letter Queue"  as DLQ <<error>>
actor     "Operator"           as OP
```

- `component` — first-party apps/services (frontends, API servers, workers, orchestration runtimes, background compute).
- `queue` — eventing/async systems.
- `node` — host / platform / deployment substrate for owned infra.
- `database` — persistence.
- `cloud` — systems you don't own.
- `actor` — human users / external initiators.
- `frame` / `package` (teal border) and `folder` (cyan border) — groupings / bounded contexts.

The element keywords also carry sensible default colors, so an untagged `component` already reads as
an app — but prefer the explicit stereotype so the role is legible and the canonical fill is applied
(e.g. `<<cloud>>` is slate, distinct from a bare `cloud`'s cyan-bordered outline).

## Arrows — intent by macro

Intent is carried by line **style** (bold/dotted/dashed) as well as color, so it survives greyscale
and color-blind viewing. Use one macro per edge, chosen by what the edge *means*:

| Macro | Use for | Renders |
| --- | --- | --- |
| `ARROW_MAIN` | primary / synchronous happy path | bold |
| `ARROW_OPTIONAL` | alt / re-run / resume / retry / optional dependency | dotted |
| `ARROW_QUEUE` | internal async hand-off (background task, event bus) | bold, lime |
| `ARROW_CLOUD` | edge that crosses a boundary to an external system | dashed, bold |
| `ARROW_ERROR` | failure / cancel / destructive transition | bold, red |

```puml
OP  ARROW_MAIN     WEB : opens
WEB ARROW_MAIN     API : " ""POST /jobs"" "
API ARROW_QUEUE    BUS : enqueue
BUS ARROW_QUEUE    WK  : consume
WK  ARROW_CLOUD    LLM : call model
WK  ARROW_MAIN     PG  : persist
API ARROW_OPTIONAL PG  : cache read
WK  ARROW_ERROR    DLQ : on failure
```

Rules of thumb:

- Pick the color/style by edge **intent** — don't paint a happy-path edge red just because it ends at a sad-path node.
- Reserve `ARROW_CLOUD` for edges whose trigger is an external system (vendor response, webhook); a background task that stays in-process is `ARROW_QUEUE`.
- Don't make every dependency primary. Default: primary user/runtime/control path = `ARROW_MAIN`; supporting integrations, metadata lookups, validators, optional subsystems = `ARROW_OPTIONAL`.
- Mixing plain `-->` / `..>` with the macros is fine when raw arrows already carry the meaning (e.g. component diagrams where color lives on the nodes).

**Legacy aliases** (still available from `proveo.puml`): `PATH_MAIN` (`thickness=3`) and `PATH_COMMON`
(`thickness=1`) for hand-rolled colored arrows like `-[#005F7F,PATH_MAIN]->`. Prefer the `ARROW_*`
macros for new work.

## Label macros

Three colored-text macros for arrow labels and notes (also from the theme):

| Macro | Renders | Use for |
| --- | --- | --- |
| `errorLabel(x)` | bold red | failure / rejection annotations |
| `successLabel(x)` | bold green | success / completion annotations |
| `dbLabel(x)` | bold gray | persistence / state annotations |

```puml
A ARROW_MAIN  B : successLabel(committed)
B ARROW_ERROR C : errorLabel(rejected)
```

## Text formatting (Creole)

PlantUML labels/notes accept a subset of Creole. Use it to distinguish prose from code references.

| Markup | Renders | Use for |
| --- | --- | --- |
| `**bold**` | bold | section labels inside notes, callouts |
| `//italic//` | italic | conceptual emphasis, never code |
| `""monospaced""` | monospaced | code identifiers: functions, classes, RPCs, constants, fields, file paths, env vars |
| `__underline__` | underline | rare — only when bold is taken |
| `--strike--` / `~~strike~~` | strikethrough | deprecated paths in transitional diagrams |

Block-level (legal inside notes): headers via `<size:N>…</size>` or `**Title**` lines; color via
`<color:#CB2000>text</color>`; background via `<back:#585858>text</back>`; lists with `* item` / `# item`;
horizontal rule via a line of `====` or `----`; inline images via `<img:url>`.

### Single quotes for string literals

`""` (two double-quotes) is the Creole monospace delimiter, so a literal `"` inside a label miscounts
the quote pairs. When a label references a string-literal value from code (enum value, kwarg, header
name), **use single quotes**:

```puml
A --> B : ""StopSession(action='pause')""\n[""session.status"" == 'executing']
```

Single quotes are only special at the start of a logical line, so they're safe inside labels/notes.
Reserve `""…""` for the surrounding identifier. `&quot;` works but is noisy and grep-hostile — avoid it.

### What to wrap in `""…""`

Wrap when the reader benefits from "this is the exact name in code": function/method calls
(`""updateStatus(sessionId, orgId)""`), class/RPC/type names (`""SessionOrchestrator""`), constants
(`""MAX_CONCURRENT_WORKERS""`), fields/columns/JSON keys (`""plan_json""`, `""session.status""`), file
paths (`""apps/web/src/lib/model-grid.ts""`), env vars / channel formats (`""DATABASE_URL""`,
`""org:{orgId}:{resource}:{id}""`).

Do **not** wrap: plain prose ("session", "executing", "the orchestrator"); node IDs that already appear
as styled boxes; numbers, units, or natural-language verbs.

## Naming

Prefer explicit names over generic boxes. Good: `apps/web Model Grid UI`, `apps/api Session Routes`,
`apps/worker Background Processor`. Less good: `Frontend`, `Backend`, `Service Layer`.

## Current state vs future direction

Default to **current implementation truth**. If future direction matters, keep it in notes; do not
rename current components to future-state abstractions or imply systems exist before they do. A note
saying "current architecture is a stepping stone toward X" is fine; labeling a current relational
schema as the future service abstraction is not.

## Historical diagrams

`_spec/_refactors/` holds frozen before/after and migration snapshots. They do **not** follow the
current theme/conventions — ignore them by default; don't update, lint, or validate them against
current source. They are also exempt from the SPEC referencing rule.

## Layout hints

Auto-layout clusters awkwardly; use **hidden arrows** (no arrowhead) to space elements. Wrap them in a
clearly marked block so agents/editors skip them, use `-[hidden]-` (never `-[hidden]->`), and keep them
in one place:

```puml
' --- IGNORE: layout hints (do not edit) ---
web -[hidden]- worker          ' horizontal spacing within a container
DEPLOY -down[hidden]-- INFRA    ' push infra below deploy
GH -right[hidden]- BUILD        ' place build phase beside trigger
' --- END IGNORE ---
```

## Validation gotchas

Run `plantuml -checkonly file.puml` on every new/edited `.puml` (empty stdout + exit 0 = clean). Common
parser errors:

- **Mixing diagram types.** A file opening with `class …` is parsed as a class diagram and rejects component primitives (`cloud`, `database`, `folder`, `component`). Convert to `class "name" as X <<stereotype>> #color`.
- **Nested `[ ]` in `component [...]` labels.** Type annotations like `dict[str, Fact]` collide with the bracket-form parser — move the detail to a `note`, or use `rectangle "label" as X`.
- **Nested `""…""` inside quoted declarations.** `participant "…"`, `actor "…"`, `database "…"`, `component "…"` use the first inner `"` as the closing delimiter. Drop the monospace in the declaration label, or use the bracket form `[...]`.
- **Deprecated `#color:text;` activity-node prefix.** New form is `:text; <<#color>>`.
- **Arrow labels that are entirely `""…""` lose formatting.** When the label after `:` starts with the Creole double-quote pair, PlantUML treats it as a quoted string and strips the inner content. Wrap the whole label in outer quotes:
  ```puml
  ' Wrong — renders plain or breaks:
  EX --> FR : ""registry.add(fact)""
  ' Right — outer "" keeps the inner ""…"" monospaced:
  EX --> FR : " ""registry.add(fact)"" "
  ```
  Only needed when the entire label is monospace; mixed prose like `: invokes ""add(fact)""` is fine.

## Rule of thumb

Each diagram should clearly answer one of: What's the primary runtime path? What is state vs compute
vs orchestration? Which dependencies are core vs supporting? What is current reality vs future intent?
