# Level 2 — Single prompts / skills

One crafted system prompt or reusable **skill** — no reasoning loop (L3), no tools harness (L4).

This tier does **not** archive “top prompts.” It documents **where the market publishes them** and
**how to reach / query / fetch leaderboards** so an expert can pull current popularity on demand.

| Artifact | Role |
| --- | --- |
| [`discovery/`](./discovery/) | Source map + per-channel fetch contracts (PlantUML) |
| [`discovery/how-to-query.md`](./discovery/how-to-query.md) | Copy-paste CLI / HTTP recipes |

Popularity proxies differ by product type — do not mix them:

| Product type | Rank signal | Primary surface |
| --- | --- | --- |
| Agent skills (`SKILL.md`) | **Install counts** | [skills.sh](https://skills.sh) |
| First-party skills | Vendor curated + stars | [anthropics/skills](https://github.com/anthropics/skills) |
| Classic one-shots | Stars / HF downloads | [prompts.chat](https://prompts.chat) |
| Product system prompts | Archive freshness (extracted) | e.g. [system_prompts_leaks](https://github.com/asgeirtj/system_prompts_leaks) |
