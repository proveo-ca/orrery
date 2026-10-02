#!/usr/bin/env bash
# Assert build-llm-context.sh behaviour against a pinned fixture.
# Run from anywhere: bash scripts/test-build-llm-context.sh
#
# Oracle note: goldens were locked against the original Perl generator (normalized
# self-refs), then re-emitted by the bash port. EXPECTED_*_SHA256 hashes freeze the
# normalized payload so a golden rewrite cannot silently drift.
set -euo pipefail

SCRIPTS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FIXTURE_REPO="$SCRIPTS_DIR/fixtures/build-llm-context/repo"
GOLDEN_DIR="$SCRIPTS_DIR/fixtures/build-llm-context/golden"

# Normalized (self-ref-neutral) SHA-256 of golden payloads
EXPECTED_LLMS_SHA256='48c5553330c46f34eeba29f18941e132efe7ca147339a3c9a79b0136800ffcfa'
EXPECTED_FULL_SHA256='5cf9ac070e7e9b28fe887fa05dc1993ad90072f14133e38e5df65ef892857c14'

die() { printf 'FAIL: %s\n' "$*" >&2; exit 1; }
pass() { printf 'ok - %s\n' "$*"; }

resolve_sut() {
  if [[ -n "${BUILD_LLM_CONTEXT:-}" ]]; then
    printf '%s\n' "$BUILD_LLM_CONTEXT"
    return
  fi
  if [[ -f "$SCRIPTS_DIR/build-llm-context.sh" ]]; then
    printf '%s\n' "$SCRIPTS_DIR/build-llm-context.sh"
    return
  fi
  die "no build-llm-context.sh found (set BUILD_LLM_CONTEXT)"
}

# Normalize self-references so regenerate-command wording stays comparable.
normalize_output() {
  sed -E \
    -e 's|bash scripts/build-llm-context\.sh|RUN scripts/build-llm-context|g' \
    -e 's|scripts/build-llm-context\.sh|scripts/build-llm-context|g'
}

sha256_file() {
  # Portable: sha256sum (GNU) or shasum -a 256 (BSD)
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" | awk '{print $1}'
  else
    shasum -a 256 "$1" | awk '{print $1}'
  fi
}

SUT_SRC="$(resolve_sut)"
SUT_SRC="$(cd "$(dirname "$SUT_SRC")" && pwd)/$(basename "$SUT_SRC")"
case "$SUT_SRC" in
  *.sh) ;;
  *) die "unsupported SUT extension: $SUT_SRC (expected .sh)" ;;
esac

[[ -d "$FIXTURE_REPO" ]] || die "missing fixture repo: $FIXTURE_REPO"
[[ -d "$GOLDEN_DIR" ]] || die "missing golden dir: $GOLDEN_DIR"

# Frozen oracle — catch accidental golden edits
normalize_output <"$GOLDEN_DIR/llms.txt" >"/tmp/llm-ctx-golden-llms.norm.$$"
normalize_output <"$GOLDEN_DIR/llms-full.txt" >"/tmp/llm-ctx-golden-full.norm.$$"
trap 'rm -f /tmp/llm-ctx-golden-llms.norm.$$ /tmp/llm-ctx-golden-full.norm.$$' EXIT
got="$(sha256_file /tmp/llm-ctx-golden-llms.norm.$$)"
[[ "$got" == "$EXPECTED_LLMS_SHA256" ]] || die "golden llms.txt oracle drift (got $got)"
got="$(sha256_file /tmp/llm-ctx-golden-full.norm.$$)"
[[ "$got" == "$EXPECTED_FULL_SHA256" ]] || die "golden llms-full.txt oracle drift (got $got)"
pass "golden oracle hashes"

TMP="$(mktemp -d "${TMPDIR:-/tmp}/build-llm-context-test.XXXXXX")"
cleanup() { rm -rf "$TMP"; rm -f /tmp/llm-ctx-golden-llms.norm.$$ /tmp/llm-ctx-golden-full.norm.$$; }
trap cleanup EXIT

# Materialize a throwaway checkout: fixture tree + SUT under scripts/
# (SUT resolves its repo root as dirname(script)/.. — must run inside $TMP)
cp -a "$FIXTURE_REPO/." "$TMP/"
mkdir -p "$TMP/scripts"
SUT_BASENAME="$(basename "$SUT_SRC")"
cp -a "$SUT_SRC" "$TMP/scripts/$SUT_BASENAME"
SUT="$TMP/scripts/$SUT_BASENAME"

(
  cd "$TMP"
  bash "$SUT"
) >/dev/null

[[ -f "$TMP/llms.txt" ]] || die "SUT did not write llms.txt"
[[ -f "$TMP/llms-full.txt" ]] || die "SUT did not write llms-full.txt"

# --- golden byte compare (self-ref normalized) ---
for name in llms.txt llms-full.txt; do
  normalize_output <"$TMP/$name" >"$TMP/$name.norm"
  normalize_output <"$GOLDEN_DIR/$name" >"$TMP/$name.golden.norm"
  if ! cmp -s "$TMP/$name.norm" "$TMP/$name.golden.norm"; then
    diff -u "$TMP/$name.golden.norm" "$TMP/$name.norm" >&2 || true
    die "golden mismatch: $name"
  fi
  pass "golden match: $name"
done

# --- structural asserts (independent of goldens) ---
grep -q '^## Overview diagrams$' "$TMP/llms.txt" || die "missing Overview diagrams section"
grep -q 'business-needs-funnel\.puml' "$TMP/llms.txt" || die "overview funnel link missing from static HDR"
overview_hits="$(grep -c 'business-needs-funnel\.puml' "$TMP/llms.txt" || true)"
[[ "$overview_hits" -eq 1 ]] || die "overview funnel should appear once (got $overview_hits)"

grep -q '^## Study-cases -- Level 3 (meta-prompt loops)$' "$TMP/llms.txt" || die "missing L3 section"
grep -q 'Alpha Case' "$TMP/llms.txt" || die "missing Alpha Case"
grep -q 'Level 3' "$TMP/llms.txt" || die "digit level note missing"
grep -q 'Beta With Spaces' "$TMP/llms.txt" || die "title whitespace not collapsed"
grep -q 'Level 4 (governance)' "$TMP/llms.txt" || die "digit+suffix level note missing"
grep -q 'Gamma Tool' "$TMP/llms.txt" || die "nested applied path missing"
grep -q 'n/a (substrate)' "$TMP/llms.txt" || die "n/a level note missing"
grep -q '\[orphan\]' "$TMP/llms.txt" || die "basename fallback for missing title failed"
grep -q ': study-case$' "$TMP/llms.txt" || die "? level → study-case note missing"
grep -q 'Epsilon → special' "$TMP/llms.txt" || die "utf-8 title / free-text level missing"
grep -q ': experimental$' "$TMP/llms.txt" || die "free-text level note missing"

# empty buckets must not emit headings (fixture has no L5/L6/anti-framework)
grep -qE '^## Study-cases -- Level 5' "$TMP/llms.txt" && die "empty L5 bucket should be omitted" || true
grep -qE '^## Study-cases -- Level 6' "$TMP/llms.txt" && die "empty L6 bucket should be omitted" || true
grep -qE '^## Study-cases -- Level 4 / anti-framework' "$TMP/llms.txt" && die "empty anti-framework bucket should be omitted" || true
pass "structural llms.txt checks"

# digest order: first FILE after header should be README.md; llms.txt must not appear
first_file="$(awk '/^FILE: /{print $2; exit}' "$TMP/llms-full.txt")"
[[ "$first_file" == "README.md" ]] || die "digest should start with README.md (got $first_file)"
grep -q '^FILE: llms.txt$' "$TMP/llms-full.txt" && die "llms.txt must be skipped in digest" || true
grep -q '^FILE: AGENTS.md$' "$TMP/llms-full.txt" || die "AGENTS.md missing from digest"
grep -q '^FILE: skills/spec/SKILL.md$' "$TMP/llms-full.txt" || die "SKILL.md missing from digest"
grep -q '^FILE: _spec/overview/study-map.vega.json$' "$TMP/llms-full.txt" || die "extra_inline vega missing"
grep -q '^FILE: _spec/study-cases/3-meta-prompt-loops/no-nl.puml$' "$TMP/llms-full.txt" || die "no-nl puml missing"
grep -qE '^={72}$' "$TMP/llms-full.txt" || die "72-char FILE banner missing"

# no-nl contract: fixture source has no trailing NL; digest must still terminate the body
# before the next banner (Perl: append "\n" unless body =~ /\n\z/)
last_byte="$(tail -c1 "$FIXTURE_REPO/_spec/study-cases/3-meta-prompt-loops/no-nl.puml" | od -An -t x1 | tr -d ' \n')"
[[ "$last_byte" != "0a" ]] || die "no-nl fixture unexpectedly ends with newline"
awk '
  $0 == "FILE: _spec/study-cases/3-meta-prompt-loops/no-nl.puml" { want = 1 }
  want && $0 == "@enduml" { saw_end = 1 }
  saw_end && $0 == "FILE: _spec/study-cases/4-harness/applied/software/gamma.puml" { ok = 1; exit }
  END { exit(ok ? 0 : 1) }
' "$TMP/llms-full.txt" || die "no-nl body not followed by next FILE banner"

pass "structural llms-full.txt checks"

# sorted puml order in digest (awk — no Perl dependency)
awk '/^FILE: _spec\/.*\.puml$/ {print substr($0, 7)}' "$TMP/llms-full.txt" >"$TMP/pumls.got"
LC_ALL=C sort "$TMP/pumls.got" >"$TMP/pumls.exp"
cmp -s "$TMP/pumls.got" "$TMP/pumls.exp" || die "puml FILE order is not LC_ALL=C sorted"
pass "puml digest order sorted"

# expected embedded FILE count: 7 md_core (skip llms) + 5 extra_inline + 8 pumls = 20
file_count="$(grep -c '^FILE: ' "$TMP/llms-full.txt" || true)"
[[ "$file_count" -eq 20 ]] || die "expected 20 FILE banners (got $file_count)"
pass "digest FILE count"

# Optional study guide coverage.
guide='_spec/study-cases/auditable-policy-learning.md'
diagram='_spec/study-cases/6-post-training/auditable-policy-learning.puml'
mkdir -p "$TMP/_spec/study-cases/6-post-training"
printf '# Auditable Policy Learning\n\nfixture: α + beta\nordered intents remain ordered\n' >"$TMP/$guide"
printf '@startuml\ntitle Auditable Policy Learning\n\047 Level: 6\n@enduml\n' >"$TMP/$diagram"
bash "$SUT" >/dev/null
guide_hits="$(grep -F -c "]($guide)" "$TMP/llms.txt" || true)"
[[ "$guide_hits" -eq 1 ]] || die "study guide must appear once in curated index (got $guide_hits)"
grep -q '^## Study guides$' "$TMP/llms.txt" || die "study guide section missing"
grep -F -q "]($diagram): Level 6" "$TMP/llms.txt" || die "learning diagram discovery failed"
grep -F -q "FILE: $guide" "$TMP/llms-full.txt" || die "study guide body missing from digest"
body_start="$(awk -v marker="FILE: $guide" '$0 == marker { print NR + 3; exit }' "$TMP/llms-full.txt")"
guide_lines="$(wc -l <"$TMP/$guide")"
body_end="$((body_start + guide_lines - 1))"
sed -n "${body_start},${body_end}p" "$TMP/llms-full.txt" >"$TMP/guide.embedded"
cmp -s "$TMP/$guide" "$TMP/guide.embedded" || die "study guide bytes changed during embedding"
guide_file_hits="$(grep -F -c "FILE: $guide" "$TMP/llms-full.txt" || true)"
[[ "$guide_file_hits" -eq 1 ]] || die "study guide body must be embedded once"
cp "$TMP/llms.txt" "$TMP/llms.first"
cp "$TMP/llms-full.txt" "$TMP/llms-full.first"
bash "$SUT" >/dev/null
cmp -s "$TMP/llms.txt" "$TMP/llms.first" || die "curated index regeneration changed bytes"
cmp -s "$TMP/llms-full.txt" "$TMP/llms-full.first" || die "digest regeneration changed bytes"
pass "study guide discovery, exact embedding, and deterministic regeneration"

# Optional companion workbook coverage.
workbook='_spec/study-cases/auditable-policy-learning-decisions.md'
cp "$TMP/llms.txt" "$TMP/llms.without-workbook"
cp "$TMP/llms-full.txt" "$TMP/llms-full.without-workbook"
printf '# Policy Learning Decision Workbook\n\nfixture: α + decisions\nchoose evidence before execution\n\n' >"$TMP/$workbook"
bash "$SUT" >/dev/null
workbook_hits="$(grep -F -c "]($workbook)" "$TMP/llms.txt" || true)"
[[ "$workbook_hits" -eq 1 ]] || die "workbook must appear once in curated index"
[[ "$(grep -c '^## Study guides$' "$TMP/llms.txt")" -eq 1 ]] || die "guides must share one heading"
awk -v guide="]($guide)" -v workbook="]($workbook)" 'index($0, guide) { g=NR } index($0, workbook) { w=NR } END { exit(g > 0 && w > g ? 0 : 1) }' "$TMP/llms.txt" || die "workbook index must follow study guide"
[[ "$(grep -F -c "FILE: $workbook" "$TMP/llms-full.txt")" -eq 1 ]] || die "workbook must be embedded once"
awk -v guide="FILE: $guide" -v workbook="FILE: $workbook" '$0 == guide { g=NR } $0 == workbook { w=NR } END { exit(g > 0 && w > g ? 0 : 1) }' "$TMP/llms-full.txt" || die "workbook digest must follow study guide"
body_start="$(awk -v marker="FILE: $workbook" '$0 == marker { print NR + 3; exit }' "$TMP/llms-full.txt")"
body_end="$(awk -v start="$body_start" 'NR >= start && length($0) == 72 && $0 ~ /^=+$/ { print NR - 3; exit }' "$TMP/llms-full.txt")"
[[ -n "$body_end" ]] || die "workbook has no following digest boundary"
sed -n "${body_start},${body_end}p" "$TMP/llms-full.txt" >"$TMP/workbook.embedded"
cmp -s "$TMP/$workbook" "$TMP/workbook.embedded" || die "workbook bytes or trailing newlines changed"
cp "$TMP/llms.txt" "$TMP/llms.with-workbook"
cp "$TMP/llms-full.txt" "$TMP/llms-full.with-workbook"
bash "$SUT" >/dev/null
cmp -s "$TMP/llms.txt" "$TMP/llms.with-workbook" || die "workbook index regeneration changed bytes"
cmp -s "$TMP/llms-full.txt" "$TMP/llms-full.with-workbook" || die "workbook digest regeneration changed bytes"
rm "$TMP/$guide"
bash "$SUT" >/dev/null
[[ "$(grep -c '^## Study guides$' "$TMP/llms.txt")" -eq 1 ]] || die "workbook alone must retain guide heading"
grep -F -q "]($guide)" "$TMP/llms.txt" && die "absent guide must not emit link" || true
grep -F -q "FILE: $guide" "$TMP/llms-full.txt" && die "absent guide must not be embedded" || true
[[ "$(grep -F -c "]($workbook)" "$TMP/llms.txt")" -eq 1 ]] || die "workbook alone must retain link"
[[ "$(grep -F -c "FILE: $workbook" "$TMP/llms-full.txt")" -eq 1 ]] || die "workbook alone must remain embedded"
printf '# Auditable Policy Learning\n\nfixture: α + beta\nordered intents remain ordered\n' >"$TMP/$guide"
rm "$TMP/$workbook"
bash "$SUT" >/dev/null
cmp -s "$TMP/llms.txt" "$TMP/llms.without-workbook" || die "workbook removal changed other index content"
cmp -s "$TMP/llms-full.txt" "$TMP/llms-full.without-workbook" || die "workbook removal changed other digest content"
pass "workbook discovery, exact embedding, ordering, regeneration, standalone presence, and removal"

# Contribution workflow coverage.
contribution='CONTRIBUTING.md'
grep -q '^## Contribute$' "$TMP/llms.txt" && die "absent contribution guide must not emit a section" || true
grep -F -q "](CONTRIBUTING.md)" "$TMP/llms.txt" && die "absent contribution guide must not emit a link" || true
grep -q '^FILE: CONTRIBUTING.md$' "$TMP/llms-full.txt" && die "absent contribution guide must not be embedded" || true
cp "$TMP/llms.txt" "$TMP/llms.without-contribution"
cp "$TMP/llms-full.txt" "$TMP/llms-full.without-contribution"
printf '# Contributing to Orrery\n\nfixture: α + contribution workflow\nverify before publishing\n\n' >"$TMP/$contribution"
bash "$SUT" >/dev/null
contribution_hits="$(grep -F -c "](CONTRIBUTING.md)" "$TMP/llms.txt" || true)"
[[ "$contribution_hits" -eq 1 ]] || die "contribution guide must appear once in curated index"
contribution_sections="$(grep -c '^## Contribute$' "$TMP/llms.txt" || true)"
[[ "$contribution_sections" -eq 1 ]] || die "contribution section must appear once"
awk '/^## Contribute$/ { contribution = NR } /^## Consume as context$/ { consume = NR } END { exit(contribution > 0 && consume > contribution ? 0 : 1) }' "$TMP/llms.txt" || die "contribution workflow must precede context consumption"
contribution_file_hits="$(grep -c '^FILE: CONTRIBUTING.md$' "$TMP/llms-full.txt" || true)"
[[ "$contribution_file_hits" -eq 1 ]] || die "contribution body must be embedded once"
body_start="$(awk '$0 == "FILE: CONTRIBUTING.md" { print NR + 3; exit }' "$TMP/llms-full.txt")"
body_end="$(awk -v start="$body_start" 'NR >= start && length($0) == 72 && $0 ~ /^=+$/ { print NR - 3; exit }' "$TMP/llms-full.txt")"
[[ -n "$body_end" ]] || die "contribution body has no following digest boundary"
sed -n "${body_start},${body_end}p" "$TMP/llms-full.txt" >"$TMP/contribution.embedded"
cmp -s "$TMP/$contribution" "$TMP/contribution.embedded" || die "contribution body bytes or trailing newlines changed"
cp "$TMP/llms.txt" "$TMP/llms.with-contribution"
cp "$TMP/llms-full.txt" "$TMP/llms-full.with-contribution"
bash "$SUT" >/dev/null
cmp -s "$TMP/llms.txt" "$TMP/llms.with-contribution" || die "contribution index regeneration changed bytes"
cmp -s "$TMP/llms-full.txt" "$TMP/llms-full.with-contribution" || die "contribution digest regeneration changed bytes"
rm "$TMP/$contribution"
bash "$SUT" >/dev/null
cmp -s "$TMP/llms.txt" "$TMP/llms.without-contribution" || die "removing the contribution guide changed other index content"
cmp -s "$TMP/llms-full.txt" "$TMP/llms-full.without-contribution" || die "removing the contribution guide changed other digest content"
pass "contribution discovery, exact embedding, ordering, regeneration, and removal"

printf 'ALL PASSED (SUT=%s)\n' "$SUT"
