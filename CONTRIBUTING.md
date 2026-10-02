# Contributing to Orrery

Contributions are welcome from humans and agents. Turn useful engineering lessons into a sourced,
generic study-case or study guide that another reader can understand and verify independently.

Read [AGENTS.md](AGENTS.md) before editing. [CLAUDE.md](CLAUDE.md) mirrors those operating rules.
For learning-surface content, also read [_spec/CONTRIBUTING.md](_spec/CONTRIBUTING.md) and the
[spec skill](skills/spec/SKILL.md). This document describes the contribution workflow; it does not
grant permission to publish or override applicable instructions.

## 1. Confirm scope and authorization

| Contribution | Repository surface |
|---|---|
| Generic technique or architecture | `_spec/study-cases/<capability-level>/` |
| Cross-cutting study guide | `_spec/study-cases/<topic>.md` |
| Navigation or context discovery | Root documentation and `scripts/build-llm-context.sh` |
| Application changes | The independent repository inside the relevant `projects/*` submodule |

Root learning work does not require recursive submodule initialization or application dependencies.
Do not change submodule revisions as a side effect of writing documentation.

An explicit request to open or update a PR authorizes the corresponding commit, push, and PR
operation for that target. Documentation and available credentials alone do not. Ask before
expanding the target or operation, such as creating an unrequested fork, merging, or deploying.
Keep normal hooks enabled. Do not amend or force-push unless explicitly requested.

## 2. Inspect the checkout and choose the branch

If no checkout exists, clone into a verified writable parent directory:

```bash
gh repo clone proveo-ca/orrery orrery
```

Run the remaining commands from the Orrery checkout root. Inspect existing work and publication
access before changing branches:

```bash
git status --short --branch
git remote -v
gh auth status
gh repo view proveo-ca/orrery --json nameWithOwner,defaultBranchRef,viewerPermission
git log --oneline -10
```

Preserve unrelated changes. Confirm that this is the intended repository and that the publication
remote belongs to the requested target. Use existing authentication without exposing tokens or
copying credentials into files or remote URLs.

For a new contribution, create a branch from the verified upstream checkout. This preparation
works for either publication route:

```bash
base="$(gh repo view proveo-ca/orrery --json defaultBranchRef --jq '.defaultBranchRef.name')"
branch="docs/your-topic"
git fetch origin "$base" &&
git switch -c "$branch" "origin/$base"
```

Replace the topic with a descriptive name. Stop on a failed command and resolve it before continuing.
With verified upstream write access, select that publication route:

```bash
publish_remote="origin"
head="$branch"
```

If upstream write access is unavailable and creating a fork is explicitly authorized:

```bash
gh repo fork proveo-ca/orrery --remote --remote-name fork --clone=false &&
publish_remote="fork" &&
fork_owner="$(gh api user --jq '.login')" &&
head="$fork_owner:$branch"
git remote -v
```

Verify that the fork remote belongs to the authorized account. Reuse an existing verified fork
or remote rather than overwriting it. Lack of upstream access does not authorize a fork by itself.

For an existing PR, inspect its state and head repository, then check out that head branch:

```bash
gh pr view "$pr_number" --repo proveo-ca/orrery \
  --json state,url,baseRefName,headRefName,headRepository,headRepositoryOwner
gh pr checkout "$pr_number" --repo proveo-ca/orrery
```

Set `pr_number` to the requested PR. Confirm the checked-out branch and its upstream with
`git status --short --branch` and `git branch -vv`. Set `branch` to that branch and `publish_remote`
to its verified publication remote. Add a new commit rather than opening a duplicate PR.

## 3. Author a sourced, reusable contribution

Choose the appropriate [capability level](_spec/study-cases/README.md). Check neighboring files
before adding a new topic. Prefer one coherent concept over a transcript of project history.

- Verify primary references against actual abstract, venue, standard, official documentation,
  or repository pages. A remembered identifier is not verification.
- Keep examples generic. Do not copy private records, credentials, local paths, or user data.
- Distinguish a required contract, an illustrative experiment, implemented checks, and measured
  results. A diagram or a passing contract test does not demonstrate learning improvement.
- For a study guide, include its audience, learning objectives, an abstract, sources, exercises,
  expected evidence, and assurance limits.
- For a diagram, follow the theme, role, arrow, citation, and matching `Level:` conventions in
  [_spec/CONTRIBUTING.md](_spec/CONTRIBUTING.md). Include a rendered SVG for browsing.
- Link related cases and place a short discovery link in the relevant README.

An example is [Auditable Policy Learning](_spec/study-cases/auditable-policy-learning.md), with
its [diagram source](_spec/study-cases/6-post-training/auditable-policy-learning.puml).

## 4. Update discovery through the generator

Do not hand-edit `llms.txt` or `llms-full.txt`.

The generator automatically discovers `.puml` files. Markdown bodies use an explicit `md_core`
list in `scripts/build-llm-context.sh`; a README link alone does not embed a new guide.
Register a new Markdown guide there and add a curated index link. Extend the generator tests
to verify discovery, exact embedding, and repeatable output.

Preserve the existing fixture oracle. Do not rewrite its frozen hashes merely to hide a regression.
Optional new documents can receive temporary-fixture coverage without changing baseline goldens.

## 5. Verify and review

For each changed diagram, set `diagram` to its actual source path and validate before rendering:

```bash
plantuml -checkonly "$diagram"
plantuml -tsvg "$diagram"
```

For root documentation and context changes:

```bash
bash -n scripts/build-llm-context.sh scripts/test-build-llm-context.sh
bash scripts/build-llm-context.sh
bash scripts/test-build-llm-context.sh
cmp AGENTS.md CLAUDE.md
git diff --check
```

Inspect the rendered diagram, relative links, actual embedded document bodies, and generated diff.
Confirm that the index links each new item once and that regeneration produces identical bytes.
Obtain the reviews required by [AGENTS.md](AGENTS.md); fix blocking findings before publication.
If a check cannot run, record its exact omission and reason rather than claiming a pass.

## 6. Publish the authorized change

Before committing, inspect status, the full diff, and recent commits. Stage only intended paths,
including regenerated artifacts, and inspect the staged diff. Do not stage the entire checkout
indiscriminately.

```bash
git status --short
git diff
git log --oneline -10
git add -- "$changed_source" llms.txt llms-full.txt &&
git diff --cached --check &&
git diff --cached
```

Set `changed_source` to the actual file and explicitly add each changed render, README, instruction,
or script as needed. Review the staged diff, then recheck the destination remote and branch against
the authorized target before publishing. Chain the push to a successful commit so a rejected hook
cannot publish older work:

```bash
git remote -v
git branch -vv
git commit -m "docs: add sourced study guide" &&
git push -u "$publish_remote" "$branch"
```

For an existing PR, use the verified head branch and remote; no additional PR is needed.

For a new PR, first check whether its head branch already has an open PR. Prepare reviewed PR
text in a separate file, set `pr_body` to that file, and open the contribution:

```bash
gh pr list --repo proveo-ca/orrery --head "$branch" --state open
gh pr create --repo proveo-ca/orrery --base "$base" --head "$head" \
  --title "docs: add sourced study guide" --body-file "$pr_body"
```

The fork route sets `head` to `owner:branch`; the upstream route sets it to the branch name.
The PR should explain the learning value, changed sources, citation scope, verification commands
and results, and any remaining limitations. After publishing, verify the PR's target and state,
check that the local worktree is clean, and return its URL. Do not merge without authorization.

## Submission checklist

- [ ] Applicable instructions, target repository, and publication authorization are confirmed.
- [ ] The contribution belongs in the shared learning surface and preserves unrelated work.
- [ ] Primary references are verified; claims distinguish contracts from measured results.
- [ ] Source, render, and README links agree.
- [ ] Curated navigation and full-context embedding include the contribution.
- [ ] Generator checks, applicable rendering checks, and required reviews passed or are disclosed.
- [ ] Only intended files are committed; an existing PR is updated rather than duplicated.
- [ ] The resulting PR URL and state are reported accurately.
