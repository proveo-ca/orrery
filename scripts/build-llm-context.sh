#!/usr/bin/env bash
# Rebuild llms.txt (curated index) and llms-full.txt (inline digest) for LLM scrapers.
# Run from repo root: bash scripts/build-llm-context.sh
# Requires Bash 4+ (associative arrays, mapfile).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

write_out() {
  local path="$1"
  local body="$2"
  printf '%s' "$body" >"$path"
  local bytes
  bytes="$(wc -c <"$path" | tr -d ' ')"
  printf 'wrote %s (%s bytes)\n' "$path" "$bytes"
}

# Extract title + level from a .puml (first matches only). Prints: title<TAB>level
puml_meta() {
  local path="$1"
  awk '
    BEGIN { title=""; level=""; found_t=0; found_l=0 }
    !found_t && /^title[[:space:]]+/ {
      sub(/^title[[:space:]]+/, "")
      title=$0
      found_t=1
      next
    }
    !found_l && /'\'' Level:/ {
      sub(/^.*'\'' Level:[[:space:]]*/, "")
      level=$0
      found_l=1
      next
    }
    END {
      if (title == "") {
        bn=path
        sub(/^.*\//, "", bn)
        sub(/\.puml$/, "", bn)
        title=bn
      }
      gsub(/^[[:space:]]+|[[:space:]]+$/, "", title)
      gsub(/[[:space:]]+/, " ", title)
      if (level == "") level="?"
      gsub(/^[[:space:]]+|[[:space:]]+$/, "", level)
      printf "%s\t%s\n", title, level
    }
  ' path="$path" "$path"
}

section_for() {
  local rel="$1"
  case "$rel" in
    _spec/overview/*) echo overview ;;
    */study-cases/1-human-expert/computer-science/*) echo 1-human-expert/computer-science ;;
    */study-cases/1-human-expert/rag/*) echo 1-human-expert/rag ;;
    */study-cases/1-human-expert/*) echo 1-human-expert ;;
    */study-cases/2-single-prompts/discovery/*) echo 2-single-prompts/discovery ;;
    */study-cases/2-single-prompts/*) echo 2-single-prompts ;;
    */study-cases/3-meta-prompt-loops/*) echo 3-meta-prompt-loops ;;
    */study-cases/4-harness/governance/*) echo 4-harness/governance ;;
    */study-cases/4-harness/evidence-and-durability/*) echo 4-harness/evidence-and-durability ;;
    */study-cases/4-harness/meta-orchestration/*) echo 4-harness/meta-orchestration ;;
    */study-cases/4-harness/self-improving/*) echo 4-harness/self-improving ;;
    */study-cases/4-harness/applied/*) echo 4-harness/applied ;;
    */study-cases/4-harness/anti-framework/*) echo 4-harness/anti-framework ;;
    */study-cases/4-harness/framework/*) echo 4-harness/framework ;;
    */study-cases/5-fine-tuned/*) echo 5-fine-tuned ;;
    */study-cases/6-post-training/*) echo 6-post-training ;;
    */study-cases/_substrate/*) echo _substrate ;;
    *) echo other ;;
  esac
}

level_note() {
  local lv="$1"
  if [[ "$lv" == "?" ]]; then
    printf '%s\n' 'study-case'
  elif [[ "$lv" =~ ^[nN]/[aA]/ ]]; then
    printf '%s\n' "$lv"
  elif [[ "$lv" =~ ^[0-9] ]]; then
    printf 'Level %s\n' "$lv"
  else
    printf '%s\n' "$lv"
  fi
}

# --- collect sources ---
[[ -d _spec ]] || { printf 'error: missing _spec/ under %s\n' "$ROOT" >&2; exit 1; }
mapfile -t pumls < <(find _spec -type f -name '*.puml' | sed 's|^\./||' | LC_ALL=C sort)

md_core=(
  README.md
  AGENTS.md
  llms.txt
  _spec/CONTRIBUTING.md
  _spec/study-cases/README.md
  _spec/study-cases/summary.md
  _spec/study-cases/context-and-retrieval.md
  _spec/study-cases/2-single-prompts/discovery/how-to-query.md
  skills/spec/SKILL.md
)

extra_inline=(
  _spec/overview/study-map.vega.json
  skills/spec/references/plantuml.md
  skills/spec/references/mermaid.md
  skills/spec/references/vega-lite.md
  skills/spec/references/rendering.md
)

section_order=(
  overview
  1-human-expert/computer-science
  1-human-expert/rag
  1-human-expert
  2-single-prompts/discovery
  2-single-prompts
  3-meta-prompt-loops
  4-harness/governance
  4-harness/evidence-and-durability
  4-harness/meta-orchestration
  4-harness/self-improving
  4-harness/applied
  4-harness/anti-framework
  4-harness/framework
  5-fine-tuned
  6-post-training
  _substrate
  other
)

declare -A section_title=(
  [overview]='Overview diagrams'
  [1-human-expert/computer-science]='Study-cases -- Level 1 / computer-science'
  [1-human-expert/rag]='Study-cases -- Level 1 / rag'
  [1-human-expert]='Study-cases -- Level 1 (human expert)'
  [2-single-prompts/discovery]='Study-cases -- Level 2 / discovery'
  [2-single-prompts]='Study-cases -- Level 2 (single prompts / skills)'
  [3-meta-prompt-loops]='Study-cases -- Level 3 (meta-prompt loops)'
  [4-harness/governance]='Study-cases -- Level 4 / governance'
  [4-harness/evidence-and-durability]='Study-cases -- Level 4 / evidence & durability'
  [4-harness/meta-orchestration]='Study-cases -- Level 4 / meta-orchestration'
  [4-harness/self-improving]='Study-cases -- Level 4 / self-improving'
  [4-harness/applied]='Study-cases -- Level 4 / applied'
  [4-harness/anti-framework]='Study-cases -- Level 4 / anti-framework'
  [4-harness/framework]='Study-cases -- Level 4 / framework'
  [5-fine-tuned]='Study-cases -- Level 5 (fine-tuned)'
  [6-post-training]='Study-cases -- Level 6 (post-training)'
  [_substrate]='Study-cases -- substrate (orthogonal to the ladder)'
  [other]='Study-cases -- other'
)

# Bucket: section -> lines of "path<TAB>title<TAB>level" (discovery order = sorted pumls)
declare -A buckets=()
for rel in "${pumls[@]}"; do
  meta="$(puml_meta "$rel")"
  title="${meta%%$'\t'*}"
  level="${meta#*$'\t'}"
  sec="$(section_for "$rel")"
  buckets["$sec"]+="${rel}"$'\t'"${title}"$'\t'"${level}"$'\n'
done

# --- llms.txt ---
# read -d '' preserves trailing newlines (unlike $(...))
IFS= read -r -d '' llms <<'HDR' || true
# orrery

> The coordinating root for Proveo's agent projects: a constellation of independent applications
> (attached as Git submodules) orbiting a shared `_spec/` learning surface that maps how agent / LLM
> systems are built -- a 7-level capability ladder plus sourced study-cases of the field.

orrery holds no application code of its own; each `projects/*` is its own repository. The durable value
here is the `_spec/` learning surface. Diagram sources are PlantUML (`.puml`), Mermaid (`.mmd`), and
Vega-Lite (`.vega.json`); every study-case carries a `' Level:` header and a confirmed primary source.
Prefer the linked sources below over rendered `.svg` files. For a single pre-expanded digest, use
[llms-full.txt](llms-full.txt) (regenerate with `bash scripts/build-llm-context.sh`).

## Start here
- [README](README.md): what orrery is, the layout, the project list, submodule setup, and how to consume this repo as context
- [Capability ladder](_spec/study-cases/README.md): organizing model -- demand-side funnel and build-side study map (encoding depth x autonomy)
- [Authoring & sourcing rules](_spec/CONTRIBUTING.md): diagram conventions, themes, role stereotypes, `' Level:` headers, sourcing
- [Cross-cutting summary](_spec/study-cases/summary.md): the field at a glance
- [Context & retrieval](_spec/study-cases/context-and-retrieval.md): context-engineering bibliography
- [Agent workflow](AGENTS.md): team / agent operating rules when working inside this checkout (also mirrored as `CLAUDE.md`)

## Consume as context
- [Full LLM digest](llms-full.txt): inline `_spec/` + core Markdown for scrapers that do not follow links (gitingest, custom agents, paste-into-prompt)
- [spec skill](skills/spec/SKILL.md): procedural conventions for authoring / rendering proveo diagrams -- install with `npx skills add proveo-ca/orrery --skill spec` (or `npx skills add proveo-ca/spec --skill spec`)

## Overview diagrams
- [Business-needs funnel](_spec/overview/business-needs-funnel.puml): demand-side -- how a request walks down the capability ladder
- [Study map](_spec/overview/study-map.vega.json): build-side -- same tiers on encoding depth x autonomy

HDR

for key in "${section_order[@]}"; do
  [[ "$key" == overview ]] && continue
  items="${buckets[$key]:-}"
  [[ -n "$items" ]] || continue
  llms+="## ${section_title[$key]}"$'\n'
  while IFS=$'\t' read -r path title level; do
    [[ -z "${path:-}" ]] && continue
    note="$(level_note "$level")"
    llms+="- [${title}](${path}): ${note}"$'\n'
  done <<<"$items"
  llms+=$'\n'
done

IFS= read -r -d '' foot <<'FOOT' || true
## Optional
- [Proveo Vega theme (light)](_spec/themes/proveo.vega.json): vendored identity theme for `.vega.json` charts
- [Proveo Vega theme (dark)](_spec/themes/proveo-dark.vega.json): dark-canvas Vega theme
- [PlantUML reference (skill)](skills/spec/references/plantuml.md): stereotype / ARROW_* detail
- [Mermaid reference (skill)](skills/spec/references/mermaid.md): class theming
- [Vega-Lite reference (skill)](skills/spec/references/vega-lite.md): config theming
- [Rendering reference (skill)](skills/spec/references/rendering.md): install + validate + render commands
- Projects under `projects/` are Git submodules (aphelion, omnigent public; others may be private) -- scrape `_spec/` unless you explicitly need an application checkout

FOOT
llms+="$foot"

write_out llms.txt "$llms"

# --- llms-full.txt ---
IFS= read -r -d '' full <<'FULLHDR' || true
# orrery -- full LLM context digest

> Auto-generated by `scripts/build-llm-context.sh`. Prefer `llms.txt` when you can follow links;
> use this file when you need a single pasteable / scrapeable payload of the learning surface.

Do not treat rendered `.svg` files as source of truth -- diagram semantics live in `.puml` / `.vega.json`.

FULLHDR

append_file() {
  local path="$1"
  [[ -f "$path" ]] || return 0
  # Read raw bytes without stripping trailing newlines
  local body
  body="$(cat -- "$path"; printf x)"
  body="${body%x}"
  full+=$'\n\n'
  full+="$(printf '=%.0s' {1..72})"$'\n'
  full+="FILE: ${path}"$'\n'
  full+="$(printf '=%.0s' {1..72})"$'\n\n'
  full+="$body"
  if [[ "$body" != *$'\n' ]]; then
    full+=$'\n'
  fi
}

for path in "${md_core[@]}"; do
  [[ "$path" == llms.txt ]] && continue
  append_file "$path"
done
for path in "${extra_inline[@]}"; do
  append_file "$path"
done
for rel in "${pumls[@]}"; do
  append_file "$rel"
done

write_out llms-full.txt "$full"
printf 'study-case / overview .puml files: %s\n' "${#pumls[@]}"
