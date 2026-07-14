# How to query L2 popularity surfaces

Recipes only — run these when you need a *current* snapshot. Do not bake install tables into study-cases.

## A. Agent skills — [skills.sh](https://skills.sh)

**What it ranks:** packages installable with `npx skills add …`, by anonymous install telemetry
([docs](https://skills.sh/docs)). Index entry requires real installs — there is no GitHub crawler.

### Leaderboard (browse)

```text
https://skills.sh/
```

Homepage leaderboard = all-time install ranking (UI). No public “dump entire board” API is
documented; treat the HTML/RSC homepage as the canonical full ranking.

### Search API (HTTP)

```bash
# Fuzzy search; results include installs, sorted by popularity in the CLI client
curl -sL 'https://skills.sh/api/search?q=frontend&limit=10'

# Scope to a GitHub owner
curl -sL 'https://skills.sh/api/search?q=pdf&limit=10&owner=anthropics'
```

Response shape (fields): `query`, `skills[]` with `id`, `skillId`, `name`, `installs`, `source`,
plus `count`.

### CLI (same search, install path)

```bash
npx skills find frontend              # interactive / agent search
npx skills find pdf --owner anthropics
npx skills add anthropics/skills@frontend-design
npx skills list                         # local installs
```

CLI source: [vercel-labs/skills](https://github.com/vercel-labs/skills). Discovery skill:
[`find-skills`](https://github.com/vercel-labs/skills/blob/main/skills/find-skills/SKILL.md).

### Install-count badge (per repo)

```markdown
[![skills.sh](https://skills.sh/b/anthropics/skills)](https://skills.sh/anthropics/skills)
```

```text
https://skills.sh/b/{owner}/{repo}
https://skills.sh/{owner}/{repo}
https://skills.sh/{owner}/{repo}/{skill}
```

## B. First-party Agent Skills — Anthropic + standard

| Reach | How |
| --- | --- |
| Format standard | https://agentskills.io |
| Reference repo | https://github.com/anthropics/skills |
| Claude Code marketplace | `/plugin marketplace add anthropics/skills` then Browse / `/plugin install …@anthropic-agent-skills` |
| GitHub stars sort (any org) | `https://api.github.com/search/repositories?q=topic:agent-skills&sort=stars&order=desc` |

```bash
# List top public repos tagged agent-skills (stars ≠ install popularity)
curl -sL 'https://api.github.com/search/repositories?q=topic:agent-skills&sort=stars&order=desc&per_page=10' \
  | jq -r '.items[] | "\(.stargazers_count)\t\(.full_name)"'
```

## C. Classic one-shot prompts — [prompts.chat](https://prompts.chat)

Formerly *Awesome ChatGPT Prompts* — [f/prompts.chat](https://github.com/f/prompts.chat) on GitHub.

| Fetch | URL / command |
| --- | --- |
| Browse UI | https://prompts.chat/prompts |
| Raw markdown dump | https://raw.githubusercontent.com/f/prompts.chat/main/PROMPTS.md |
| CSV | https://github.com/f/prompts.chat/blob/main/prompts.csv |
| Hugging Face dataset | https://huggingface.co/datasets/fka/prompts.chat |
| Skills plugin path | `/plugin marketplace add f/prompts.chat` |

Stars on the GitHub repo remain the classic popularity proxy for this genre.

## D. Vendor system-prompt archives (product baselines)

Extracted product prompts — not authored libraries. Rank by **stars + last-commit freshness**, then
open the vendor folder you care about.

| Archive | URL |
| --- | --- |
| Multi-vendor chat / IDE | https://github.com/asgeirtj/system_prompts_leaks |
| Coding-agent teardown | https://github.com/x1xhlol/system-prompts-and-models-of-ai-tools |
| Claude Code (versioned) | https://github.com/Piebald-AI/claude-code-system-prompts |

```bash
# Discover similar archives by stars (tune the query)
curl -sL 'https://api.github.com/search/repositories?q=system+prompts+in:name,description&sort=stars&order=desc&per_page=10' \
  | jq -r '.items[] | "\(.stargazers_count)\t\(.full_name)\t\(.html_url)"'
```

Clone or raw-fetch a single file (example pattern):

```bash
# raw file from an archive path — replace owner/repo/path
curl -sL 'https://raw.githubusercontent.com/asgeirtj/system_prompts_leaks/main/README.md' | head
```

## Ranking hygiene (for study-cases)

1. Prefer **skills.sh installs** when the artifact is a `SKILL.md` package.  
2. Prefer **vendor marketplace / official repo** for first-party document skills.  
3. Prefer **prompts.chat / HF** for persona one-shots.  
4. Prefer **dated archive commits** for “what Cursor/Claude/ChatGPT actually ship.”  
5. Never cite an install table without a fetch date — leaderboards move daily.
