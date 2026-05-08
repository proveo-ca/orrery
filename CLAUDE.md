# Working in this repo

This is a loose monorepo: each `projects/*` is independent. Treat them as separate apps that happen to share a git tree.

## Rules of thumb

- **Stay inside one project.** When working on `projects/foo`, `cd` into it and use its own toolchain (its `package.json`, its `pnpm-workspace.yaml`, its `gradlew`, etc.). Don't try to run things from the repo root — there is no root build system.
- **Don't add a root `package.json` or workspace stitching.** The projects use different toolchains intentionally; unifying them would cost more than it saves.
- **Specs live in `_spec/<project>/`.** When a project needs to reference its spec, use a relative path (e.g. `../../_spec/chess-coach/...`). Don't duplicate spec content into the project tree.
- **`compose/` at the root is for cross-project orchestration only.** Project-internal compose files belong inside the project.

## Per-project guidance

Some projects have their own `CLAUDE.md` (e.g. `projects/chess-coach/CLAUDE.md`). When working in a project, read its `CLAUDE.md` first — it overrides anything here.

## When in doubt

If a change feels like it belongs at the root but isn't `_spec/`, `compose/`, or `scripts/`, it probably belongs inside a project instead. Ask before adding new top-level directories.
