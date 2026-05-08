# harness

Workspace for Proveo's experimental projects. Each `projects/*` is an independent app with its own toolchain; the root only owns shared specs and cross-cutting glue.

## Layout

```
_spec/             Shared specifications, organized per-project (_spec/<project>/...)
compose/           Top-level docker-compose files for running services across projects
projects/          Independent applications (see "Projects" below)
scripts/           Repo-wide helper scripts
```

## Projects

| Project | Stack | Notes |
| --- | --- | --- |
| [`projects/chess-coach`](projects/chess-coach) | pnpm workspace + Gradle | Internal monorepo with `apps/{api,e2e,harness,ui}` |
| [`projects/nightfall`](projects/nightfall) | Vite + Cloudflare Worker | Single app |
| [`projects/agents-of-empires`](projects/agents-of-empires) | Multi-service (Go/Docker) | See its README for component layout |

## Conventions

- **Each project is self-contained.** `cd projects/<name>` and use that project's own commands. There is no root `package.json`, no root workspace, and no cross-project task graph.
- **Shared specs live in `_spec/<project>/`** and are referenced by relative path from the consuming project (e.g. `../../_spec/agents-of-empires/components.puml`). One PR can atomically change a spec and its implementation.
- **`compose/` is for running things together** locally (e.g. `compose/chess-coach.yml`). Project-internal compose files belong inside the project.

## Why one repo and not submodules

The thing actually shared is `_spec/`. Submodules would make that worse: pinned SHAs, detached HEADs, and every project would have to remember to bump. A single repo gives atomic spec+implementation changes for free. If a project ever needs to be extracted (different contributors, release cadence, licensing), split it then — not preemptively.
