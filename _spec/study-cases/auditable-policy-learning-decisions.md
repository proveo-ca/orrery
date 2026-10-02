# Auditable Policy Learning: Decision Workbook

*Abstract:* A companion workbook for choosing ownership, accounting, representation, learning, supervision, and evidence contracts before executing an outcome-driven experiment.
*URL:* [Sutton et al. (1999)](https://papers.nips.cc/paper/1713-policy-gradient-methods-for-reinforcement-learning-with-function-approximation), [Henderson et al., v3](https://arxiv.org/abs/1709.06560v3), [Portelas et al., v2](https://arxiv.org/abs/2003.04664v2).

**Audience:** engineers who can read a state machine, a vector expression, and an API boundary.
**Learning objectives:** compare legitimate alternatives, distinguish parameter domains from tuned values, specify exactly-once learning, and identify evidence needed to accept a contract.

Read the [study guide](auditable-policy-learning.md) for the architecture and its [diagram](6-post-training/auditable-policy-learning.puml).
This workbook adds decision detail within that architecture.
It describes a **paper contract**, not a training implementation, executed validation, trained artifact, or measured improvement.
Every numeric recipe value below is an illustrative engineering choice.
No cited paper endorses these values as optimal.
Mathematical domains constrain valid parameters; they do not establish a recommended continuous tuning interval.

## How to use the workbook

For each fork, record the chosen option, the reason it fits the workload, the versioned contract it changes, and the evidence that would reject it.
Compare alternatives before observing acceptance-suite results.
An alternative can be legitimate while requiring a different experiment and different claims.
The worked example chooses split API ownership, first-action quotas, private native hooks, alternating recorded/live training, and standard central differences.
Those choices do not certify implementation readiness.

```text
Decision record
  [A] adopt the worked example with explicit versions and evidence obligations
  [B] amend named choices and restate their dependent contracts
  [C] defer execution until unresolved authority or evidence is available
Record: option + owner + contract version + rejection evidence
```

### Terms used below

| Term | Meaning |
|---|---|
| Authorized history | Current observation plus earlier facts this participant legitimately observed. |
| DTO | Data transfer object: a checked public record, not a grant of authority. |
| Reducer | A pure function that derives the next bookkeeping state from the prior state and events. |
| Lineage | An entity's identity through movement and transformation. |
| Receipt / disposition | Evidence of actual payment / whether the paid request created an entity. |
| Nominal projection | A conditional own-intent hypothesis, not a resolved future world. |
| Quota / work cap | Capacity for retained unique candidates / a bound on generation attempts. |
| Logit / temperature | A pre-normalization score / a positive scale controlling softmax concentration. |
| Baseline / advantage | An action-independent return reference / observed return minus that reference. |
| ACK / permit | Acknowledgment at a declared acceptance level / authority to begin the next work item. |
| Eligible completion | A verified completion with at least one verified sampled decision and an allowed return classification. |
| STARTED | A durably consumed launch attempt, including one that later fails. |
| Inference artifact / checkpoint | A frozen scoring model / a fuller learner-state image for diagnostics or explicitly supported restoration. |
| Capture / authenticity | Retained bytes and execution inputs / trusted evidence of who produced them and how. |

## 1. API ownership: code placement does not move authority

The worked example keeps observations and authorized events in an arena contract surface.
It keeps candidates, features, and inference artifacts in a training-owned model surface.
The host alone produces and authorizes native events.

| Option | Prefer when | Consequence and required evidence |
|---|---|---|
| A. Arena observations/events; training candidates/features/artifacts | Representation changes faster than rules or observation semantics | Audit training → authorized arena contracts → pure rules dependencies; keep coordinator and native adapter private. |
| B. Shared arena contracts also own candidates/features | Several independent policies need the same stable representation | Representation changes affect all consumers; audit public model helpers and prevent arena → trainer dependencies. |
| C. Arena owns observations and private projection; training owns the pure event reducer | Experiment-specific accounting evolves independently | Arena still owns authorized DTOs; the reducer consumes trusted events and cannot produce or authorize them. |

Use exact public entrypoints and detached checked values.
Keep filesystem, process control, corpus access, native full-state adapters, and training coordination outside model-facing exports.
A schema-valid record from an untrusted producer remains untrusted.
Verify the transitive dependency closure rather than trusting a top-level import list.

## 2. Candidate quotas: coverage policy and work accounting

An illustrative generator has seven action families, at most four actions per queue, and one explicit empty-queue candidate.
Reserve `7 × 48 + 175 + 1 = 512` unique slots.
The shared composition lane funds queues of length at least two.
Count at most `2048` attempted prefix extensions, including duplicates, pruned extensions, wrong-owner visits, and full-quota visits.
The worked example assigns family ownership from the first action and redistributes inactive reservations to active families.

| Option | Prefer when | Consequence |
|---|---|---|
| A. First non-classical action owns the queue; classical owns it when all actions are classical; inactive slots go to compositions | Special-action participation should determine representation coverage | Ordinary prefixes do not dominate ownership; mixed queues compete by the first special kind. |
| B. First action owns the queue; inactive slots go to active family lanes | Leading intent should determine coverage and single-family availability varies | Prefix order changes ownership; canonical round-robin redistribution favors available family lanes while shared capacity stays fixed. |
| C. Minimum canonical family anywhere in the queue owns it; released slots split between active families and compositions | Stable registry priority and mixed coverage matter more than leading intent | Registry order creates bias; split `floor(released/2)` to families and the remainder to compositions. |

Define active as a nonempty **authorized singleton domain**, not success under hidden admission.
If no family is active, place all non-pass capacity in the shared pool.
Deduplicate canonical queue bytes before consuming retention capacity.
Each retained queue consumes one funding pool, even when several lanes encounter it.
Keep semantic owner counts separate from funding-pool counts.

Traverse lanes in a pinned order with bounded lazy prefix iterators and depth-cyclic FIFO frontiers.
Count one attempted append before checking it.
Continue structurally valid prefixes even when current ownership or a full quota prevents retention.
A later append can change ownership.
Transfer unused capacity only after proving iterator exhaustion.
Reaching a work cap does not prove exhaustion.
Report retained lengths, owners, duplicates, prune categories, and the stop reason.

```text
attempts = pruned + ownerSkipped + duplicates + quotaSkipped + retainedNonPass
unique   = 1 + retainedNonPass = 1 + sum(retainedByOwner) = 1 + sum(poolFunding)
```

For this example, `attempts ∈ {0,…,2048}`, `unique ∈ {1,…,512}`, and `nonPass ∈ {0,…,511}`.
In a different recipe, capacities and attempt caps are nonnegative integers with a declared finite upper bound.
Reserving pass requires at least one total retained slot.
These are capacity domains, not desired sample counts or tuned coverage guarantees.
Independent small-domain enumeration can verify accounting and reveal omissions.
It cannot establish exhaustive coverage under every capped workload.

## 3. Native provenance, receipts, and transient vision

Grouped animation or result arrays need not provide a complete ordered causal trace.
Movement, swaps, transformations, and creation followed immediately by destruction require identity from actual native mutations.

| Option | Prefer when | Consequence |
|---|---|---|
| A. Private generic native trace hooks with a companion identity table | Public resolver output must stay compatible | Hooks emit ordered atomic effects and actual visibility checkpoints; keep reward and paid-cost semantics outside the rules engine. |
| B. Persistent private entity IDs in native execution and replay state | Identity is already a broad engine requirement | Version snapshot/replay codecs and preserve ID lifecycles; private IDs still cannot enter policy features. |
| C. Defer lineage-dependent accounting | No trustworthy causal seam is available yet | Keep exact paid-loss and causal-loss claims blocked; square/type continuity is not a replacement proof. |

The worked example chooses A.
It requires evidence that every atomic frame reconciles with the native state before and after the effect.
Apply swaps atomically rather than overwriting identities one square at a time.
Bind receipts to actual committed actions and native dispositions.
A payment alone does not prove creation.

```text
actualPaidDebits = paidSurviving + paidDestroyed + paidWasted
paidSurviving    = sum(actual live own lineage basis)
paidDestroyed   = sum(actual retired own lineage basis, once each)
paidWasted      = sum(actual debits whose deployment never materialized)
```

Opening endowed entities have paid basis `0` in this example.
Free transformations preserve paid basis while changing a current-type replacement proxy.
Actual creation followed by destruction contributes to destroyed basis.
An unmaterialized deployment contributes to wasted basis without an invented birth or death.
Requested cost, actual payment, and replacement value remain separate quantities.
Rejected whole-queue admission publishes no debit or receipt.
Reconcile resources, live identities, receipts, and conservation before atomically advancing history.

An enemy disappearance in fog does not prove destruction.
Publish an enemy-loss witness only for an actual native destruction authorized by the causal pre-destruction visibility image.
Its known type can support a replacement-value lower bound.
Its paid-investment lower bound can remain `0`, with unknown upper bound and witnessed-only completeness.
Do not compare that bound to exact own paid investment as if both measured the same thing.

**Transient vision matters:** a participant can legitimately see a cell during resolution and lose sight before the final snapshot.
Fold actual authorized intermediate observations into memory and ever-observed coverage before folding the final snapshot.
Piece-only reveals need not establish fully lit terrain.
Conditional own projections never update observed history.
Filter private events and empty visible deltas before assigning recipient-local sequence numbers and public IDs.
Hidden-only changes must not leak through gaps, timestamps, or private checkpoint counts.

## 4. Feature scope: dimension is not tactical completeness

The worked example uses `34 + 4 × 84 = 370` ordered coordinates: one queue block followed by four action-position blocks.
This arithmetic is a layout example, not a feature dictionary or a required model size.
An executable experiment must separately provide exact names, formulas, scales, masks, and ordering in a trusted versioned manifest.
An artifact cannot define its own replacement meanings.

Preserve original authored target knowledge separately from effective conditional own coordinates.
Separate current authorized cells, fixed currently observed opponents, and nominal own actors.
A hypothetical move can conditionally vacate an own blocker.
It cannot erase a visible opponent or turn unknown terrain into confirmed empty terrain.
Mark absent action, absent target, unknown target, known-empty target, nominal actor, and known paid basis distinctly.
An endowed zero-cost actor has known paid basis; a hypothetical birth does not.

| Option | Prefer when | Consequence |
|---|---|---|
| A. Linear ordered blocks with scoped classical geometry proxies | Auditable coefficients and bounded computation matter | Threat, pressure, protection, and exposure mean stationary classical relations only; special attacks, collisions, mine triggers, and actual legality remain outside the proxy. |
| B. Richer authorized interaction features | Known coordination failures justify additional expressiveness | Version formulas and cost bounds; test collisions and candidate-conditioned interactions rather than adding shared constants. |
| C. A versioned belief model or short-horizon search | Future authorized observations materially affect decisions | Specify beliefs, expansion caps, and separate randomness; never consult actual hidden state or future records. |

The worked example chooses A and retains all action families as intents without claiming to simulate their effects.
Unknown blockers produce uncertainty masks, not calibrated probabilities.
A novelty proxy measures conditional coverage, not expected entropy reduction.
Masks express knowledge; they are not a hidden legality oracle.
Vary hidden state while fixing authorized history and randomness to test the whole channel: candidates, keys, ordering, features, scores, and choice.

## 5. Randomness: specify bytes, algorithm, and consumption

The worked example defines an exact seed encoding named `policy-learning-rng-v1`:

```text
domain = "policy-learning-rng-v1"
master = a declared nonnegative safe integer
label  ∈ {"selection", "environment-settlement", "policy-sampling", "opponent"}
payload = UTF8(JSON.stringify([domain, master, label]))
          with no BOM, spaces, or trailing newline
root = UInt32BE(SHA256(payload)[0:4])
```

The label spelling, array order, integer encoding, and big-endian interpretation are part of the contract.
For illustrative masters `101,…,105`, retain the measured 20-root table and reject collisions without silent salting or rederivation.
Zero is a permitted uint32 root.
Truncating SHA-256 to 32 bits does not provide cryptographic stream separation or a proof of statistical independence.
Pin the downstream PRNG algorithm, its bounded parity vectors, serialized state, draw counts, and restore-next-draw behavior.
Do not insert record identities or metadata into seed derivation.

| Option | Prefer when | Consequence |
|---|---|---|
| A. Exact domain/master/label hash encoding plus a pinned small PRNG | Cross-runtime byte-level replay of a small teaching workload matters | Validate collisions and the actual output vectors; independent labels do not by themselves prove independent streams. |
| B. Documented `SeedSequence` spawning with pinned NumPy generator | Scientific tooling and hierarchical worker streams matter | Record the spawning tree, library version, generator, and full state; this is a different derivation contract. |
| C. Counter-based generation such as documented Philox | Indexed draws and parallel work need explicit stream keys | Assign unique keys/counters without reuse; record the algorithm/version and indexing scheme. |

NumPy documents B and C; it does not endorse A's custom hash truncation.
Keep selection, policy, opponent, and environment consumption separate.
Record an unused stream explicitly rather than inventing draws.
The deterministic candidate generator consumes no random stream in this example.
Each sampled decision consumes one policy uniform draw, including an empty-queue-only call.
Commit tentative child draws only at the declared verified ACK boundary.
Seeds do not make operating-system scheduling deterministic.

## 6. Baseline and optimizer: freeze the objective

REINFORCE uses the gradient of a sampled log-probability multiplied by an outcome advantage.
For a linear softmax, let `φ` be the feature vector and `τ > 0` the temperature:

```text
scoreAccum = Σ_decisions [φ(selected) − Σ_candidates π(c)φ(c)] / τ
L(w)       = −(R − b) Σ_decisions log π(selected) + λ ||w||² / 2
gradient   = −(R − b) scoreAccum + λ w
nextW      = w − η gradient
```

Use stable log-sum-exp rather than `log` of a rounded probability.
The worked example freezes weights and baseline for the entire episode.
It uses binary64 CPU arithmetic, zero initialization, `η = .001`, `τ = 1`, `λ = .0001`, summed decisions, L2 once per eligible completion, and no clipping.
These values define a reproducibility exercise, not a convergence or performance guarantee from Williams or Sutton.

| Baseline option | Prefer when | Consequence |
|---|---|---|
| A. Per-run all-history mean of prior eligible returns; startup `b = 0` | Minimal reproducible state and clear exclusion rules matter | Older returns retain influence; freeze the prior mean and include the current return only in the verified atomic commit. |
| B. Moving mean of prior eligible returns | Responsiveness to changing training distributions matters | Declare window length or decay, startup, update timing, and checkpoint state. |
| C. Learned state-conditioned baseline | A separately verified predictor justifies added complexity | Specify its loss, optimizer, input authorization, and update ordering; keep it action-independent and separate from the policy gradient. |

| Update option | Prefer when | Consequence |
|---|---|---|
| A. Summed REINFORCE with plain SGD and no clipping | A small transparent update is the experiment's goal | Episode length affects gradient magnitude; keep L2 once per completion. |
| B. Mean-normalized decisions and/or explicit gradient clipping | Length normalization or a bounded update is a declared requirement | Mean normalization reweights episodes; clipping alters update direction or magnitude; define norm, threshold, and L2 order. |
| C. Adam with a declared objective | Adaptive moments form part of the intended comparison | Persist moment buffers, step counters, epsilon, decay rates, bias correction, and regularization semantics; it is not the same SGD recipe. |

The worked example chooses baseline A and update A.

Valid mathematical domains include finite `η > 0`, `τ > 0`, and `λ ≥ 0`.
A clipping threshold, when used, must be finite and positive.
A moving-window length is a positive integer; an exponential baseline must declare its decay convention and admissible interval.
These domains do not imply that every valid value is numerically stable or useful.
Reject nonfinite features, logits, accumulators, gradients, and proposed weights before commit.
Track nonzero outcome-driven gradient updates separately from L2-only changes.

## 7. Curriculum: distributions and order are both choices

All three options below are **training** schedules with `1000` STARTED attempts per run.
They are not held-out evaluation.
Consume the schedule cursor on STARTED, not on success.

| Option | Exact full allocation and order | Prefer when |
|---|---|---|
| A. Alternating recorded/live | Zero-based even slots recorded; odd slots live; live seats alternate: `500 / 250 / 250` recorded/seat 1/seat 2 | Frequent exposure to both input sources matters from the start. |
| B. Recorded warmup, then alternation | First `200` slots recorded; remaining `800` alternate recorded/live with live seats alternating: `600 / 200 / 200` | Early recorded exposure is an explicit hypothesis worth testing. |
| C. Rotating three-way cycle | Slot modulo 3 selects recorded, live seat 1, live seat 2: `334 / 333 / 333` | Nearly equal exposure to the three training categories matters. |

B does not mean 600 recorded episodes followed by 400 live episodes.
Reset episode state and authorized history between attempts.
Preserve declared selection/policy/opponent stream continuity across attempts.
Pin recorded-input order and any seeded epoch shuffle.
Do not adapt source allocation from acceptance-suite feedback.
Portelas et al. surveys curriculum methods and motivations; it does not validate these fixed allocations.
Henderson et al. motivates careful reporting of variability and comparisons; it does not endorse five seeds or this attempt budget.

## 8. Gradient validation: tolerances have a scope

Hold sampled actions, candidate membership/order, features, return, and baseline fixed while perturbing weights.
For coordinate `i`, define central difference and coordinate acceptance:

```text
gFD_i = [L(w + ε e_i) − L(w − ε e_i)] / (2 ε)
abs(gAnalytic_i − gFD_i) ≤ atol + rtol × max(abs(gAnalytic_i), abs(gFD_i))
```

| Option | Illustrative settings | Prefer when |
|---|---|---|
| A. Standard central check | `ε = 1e-6`, `atol = 1e-8`, `rtol = 1e-5` | Fixed small bounded-logit fixtures establish a first numeric contract. |
| B. Tighter central check | `ε = 1e-6`, `atol = 1e-9`, `rtol = 1e-6` | The declared fixtures and arithmetic support a stricter discrepancy budget. |
| C. Two-step central check | Both `ε = 1e-6` and `1e-5`; `atol = 1e-8`, `rtol = 1e-5` independently | Sensitivity to step size needs an explicit diagnostic. |

The worked example chooses A.
Use sparse basis-pair cases, zero-gradient cases, regularization-only cases, and independent multi-decision cases that distinguish sum from mean.
Illustrative toy domains are 1–4 decisions, 2–4 candidates per decision, features in `[-1,1]`, and weights in `[-.25,.25]`.
They scope the fixture family rather than assert a universal tolerance.
Central-check domains require finite `ε > 0`, `atol ≥ 0`, and `rtol ≥ 0` with an informative acceptance budget.
Smaller epsilon can increase cancellation; tighter tolerances do not automatically improve assurance.
SciPy's `check_grad` documents **forward** differences, a default step near `1.49e-8`, and a returned discrepancy norm.
It does not supply these central settings or this per-coordinate pass rule.
Use exact checks for conservation, IDs, versions, quota counts, and authorization.

## 9. Supervision: define what ACK accepts

The worked example requires the parent to reconstruct and verify native results, authorized batches, candidate membership, features, probabilities, sampled draws, and compact journals before accepting a result.
The parent issues a permit before any next decision preparation, generation, scoring, or sampling.
It starts a fixed monotonic deadline **before writing** that permit.
An illustrative decision budget is `10000 ms`.
Repeated progress messages do not renew it.
Timestamp receipt of the complete raw frame before parsing; receipt at or after the deadline is late.
Check elapsed time even if the timer callback has not fired.
Node documents that timer callbacks have no exact timing or ordering guarantee.

| ACK option | Prefer when | Consequence |
|---|---|---|
| A. Parent-verified ACK | The parent must own an accepted semantic prefix | ACK follows independent reconstruction; memory acceptance alone does not claim crash durability. |
| B. Receipt ACK followed by separate verification ACK | Transport flow control must release bounded buffers early | Receipt means only bytes arrived; it cannot authorize admission, learning, or the next semantic permit. |
| C. Durable verified ACK | Recovery must preserve each accepted prefix across parent crashes | Persist and synchronize the journal/state transaction before ACK; storage latency and failure attribution join the contract. |

The worker can own the whole episode while the parent owns verification barriers and learner commits.
Both simultaneous participants still receive detached inputs from the same precommit state.
An accepted first-side result does not expose that side's queue or spend to the second side.
Bound raw frames before deserialization and release per-decision tensors after verification.
Compact accepted journals and accumulated sufficient statistics avoid retaining full candidate matrices for every decision.
Kill and reap a timed-out child before returning diagnostics.

## 10. Failure eligibility: no fabricated terminal state

| Timeout option | Prefer when | Consequence |
|---|---|---|
| A. Verified candidate deadline earns `R = -1` on the accepted sampled prefix | Decision latency belongs to the policy objective | Require parent-owned deadline/role proof; discard tentative unACKed draws/actions and use only the verified prefix. |
| B. Declare candidate timeouts excluded from learner updates | Runtime reliability is measured separately | Record every consumed attempt and exclusion count; excluded failures cannot disappear from evaluation denominators. |
| C. Declare another return/censoring recipe prospectively | A different operational objective needs explicit treatment | Version the estimator and eligibility; explain incomplete-return treatment and report it separately from native terminal outcomes. |

The worked example chooses A.
It may also assign `-1` to proved rejection of the exact verified generated queue, truthful recorded-input exhaustion, or a declared progress cap.
It obtains terminal success/neutral/failure only from authoritative native outcome.
Infrastructure exceptions, invalid output, forged progress, opponent failures, unverifiable prefixes, and storage errors abort the experiment without a fabricated learned return.
A timeout is not a synthetic terminal board.

A verified completion with **zero sampled decisions** performs no SGD, no L2, and no baseline insertion in this example.
A sampled empty queue differs: it is a real candidate selection with a verified draw and log-probability.
Even a singleton-pass call counts as a sampled decision, though its policy score gradient can be zero.
Commit an eligible episode's weights, counters, known streams, journal prefix, and return/baseline state atomically once.
Persist STARTED before launch so aborts consume the attempt budget.
Do not repair failures by silently retrying or rolling back the consumed schedule cursor.

## 11. Primary selection and publication boundaries

An illustrative experiment runs masters `101,…,105` serially from zero weights and declares seed `101` primary in advance.
Its formal primary exists only after a verified `COMPLETE` envelope binds **all five final valid artifacts**.
A later abort leaves earlier finished bytes diagnostic rather than activating a fallback primary.
This completeness rule is not a requirement to run an acceptance gate on all five artifacts.

| Selection option | Prefer when | Consequence |
|---|---|---|
| A. Predeclared seed and final valid artifact | A prospective recipe comparison should avoid favorable-seed selection | Require the full declared experiment to complete; no best-seed, checkpoint switch, averaging, or fallback. |
| B. Held-out validation selects among artifacts | Model selection is part of the intended method | Predeclare criterion, candidate set, and tie-break; retain a separate untouched test set for final claims. |
| C. Gate-driven selection | The gate is deliberately a development/selection tool | Disclose reuse and selection multiplicity; gate results no longer provide untouched generalization evidence. |

In the worked example, final validity requires all `1000` STARTED attempts to have verified completions, finite aligned coefficients, at least one nonzero outcome-driven update, and bit-exact reload.
Diagnostic cadence becomes due every `100` STARTED attempts.
Publish at the next eligible completion after atomically committing learner state.
If attempt 100 has zero choices, eligible completion 101 can fulfill that due bucket.
If attempt 1000 has zero choices, do not start 1001 to manufacture a checkpoint.
Mark the bucket fulfilled only after exclusive verified durable publication succeeds.
Serialization or file existence alone cannot fulfill it.
Publication failure stops the experiment and preserves consumed diagnostics.

| State-publication option | Prefer when | Consequence |
|---|---|---|
| A. Diagnostic checkpoints at eligible boundaries | Inspection matters without operational recovery | Retain weights, counters, baseline, streams, cursors, journal refs, and provenance; restoration fixtures do not authorize automatic resume. |
| B. Operational resume checkpoints | Continuing interrupted training is a supported requirement | Specify durable transaction replay, exactly-once commits, incomplete-attempt treatment, RNG continuity, and compatibility checks. |
| C. Final artifacts plus retained journals only | Operational resume is unnecessary | Retain final identity and audit evidence; do not advertise intermediate recoverability. |

An inference artifact supplies validated feature alignment and a detached weight vector to the scorer.
A checkpoint also carries learner/control state that inference must not consume.
Use separate schemas and reject cross-decoding.
Neither a diagnostic checkpoint nor an incomplete experiment becomes a valid inference model by renaming it.

## 12. Authenticity, canonical bytes, and capture

Hash retained physical bytes and compare them with trusted registered inputs.
A worker-supplied hash of unseen bytes is only a claim.
Independent native reexecution and authorized-batch comparison supply execution evidence that a matching hash alone cannot supply.
Retain source, tests, fixtures, configurations, dependency closure, tools, inputs, artifacts, journals, and actual runtime identities.
An inventory that silently omits computed loaders cannot certify a complete execution closure.

| Evidence option | Prefer when | Consequence |
|---|---|---|
| A. Trusted host capture and independent reexecution | The host is the declared authority | Bind retained bytes to the host's registered source and session; state the trust boundary. |
| B. Authenticated producer/signature plus capture | Remote origin needs an identity check | Bind keys to trusted identities and verify signatures; authenticity alone still does not prove correct execution. |
| C. Hash-only reference for diagnostics | Only later byte comparison is needed | Make no producer-authenticity or reproducibility claim without trusted binding and retained inputs. |

RFC 8785 specifies JCS property sorting, Unicode/input restrictions, number serialization, and UTF-8 output.
Calling `JSON.stringify` on an arbitrary object does not establish RFC 8785 conformance.
The exact three-element seed array above has a narrow declared encoding; it does not claim to implement general JCS.
For artifact/checkpoint codecs, choose either verified JCS or an explicitly named custom canonical encoding with conformance fixtures.
If bit identity including signed zero matters, specify binary64 bit encoding rather than assuming decimal JSON preserves it.
Keep content hashes external to the bytes they identify.
W3C PROV supplies entity/activity/derivation vocabulary, not cryptographic authenticity or a proof that a run occurred.

## Exercises and answer evidence

These are obligations for future implementations, not passing tests reported by this workbook.

| Exercise | Question | Expected answer evidence |
|---|---|---|
| Ownership | Can a training reducer authorize a schema-valid event? | No; show the host/channel binding and an untrusted-event rejection independently of schema validation. |
| Quotas | Compare owners for `[ordinary, special]` and `[special, ordinary]`. | First-action ownership changes; first-special ownership stays special; minimum-canonical ownership follows the declared registry. Show unique/funding totals and counted duplicate work. |
| Payments | One paid entity transforms freely then dies; another paid request never creates an entity. | Retire the first actual paid basis once; classify the second debit as waste; prove conservation without an invented birth. |
| Transient vision | A cell becomes lit during resolution then unknown at the final boundary. | Current cell ends unknown; authorized memory/coverage retains the observation; hidden-only checkpoints produce no public sequence gap. |
| Feature scope | A special attack is absent from a classical threat proxy. Is that a codec failure? | Not by itself; show representable intent separately from declared proxy scope and generator coverage. |
| RNG | Change array order, root byte order, or a trailing newline. | Show changed payload bytes or root interpretation and recompute roots without assuming collision freedom; show restore-next-draw parity and the measured collision check for the declared roster. |
| Objective | Duplicate one decision while holding the episode return fixed. | The summed policy term doubles that decision contribution; L2 remains once; the mean alternative yields a different objective. |
| Baseline | Insert the current reward before computing its own advantage. | Reject the ordering; show the frozen prior baseline and exactly-once post-verification insertion. |
| Curriculum | Count all slots of the warmup option. | 200 recorded warmup + 400 recorded + 200 live seat 1 + 200 live seat 2; all are training-used. |
| Numeric check | Tight check fails while standard check passes. | Retain both discrepancies and fixture scale; diagnose cancellation/arithmetic rather than claiming the tighter option is automatically superior. |
| ACK and deadline | Timer callback is delayed; the raw reply arrives at the deadline. | Reject as late using monotonic receipt proof; show no status-driven extension and no tentative draw commit. |
| Eligibility | Candidate times out after two accepted choices and one tentative choice. | Under option A, use reward −1 on the two verified choices; discard the third; create no terminal state. With zero accepted choices, show no SGD/L2/baseline. |
| Empty queue | No policy call versus a sampled singleton empty candidate. | First is zero decisions; second consumes one verified draw and has zero score gradient, with other eligible-update rules still explicit. |
| Publication | Attempt 100 has zero choices; eligible 101 publishes, or storage fails. | Successful durable publication fulfills bucket 1 at actual 101; storage failure fulfills nothing and stops execution. |
| Selection | Seed 101 finishes but a later declared run aborts. | No COMPLETE envelope or formal primary; preserve earlier bytes only as diagnostics under option A. |
| Evidence | A producer submits a matching digest without captured bytes. | Treat it as a reference claim; request trusted binding, retained inputs, and reexecution evidence before broader assurance. |

For each exercise, submit the invariant, a counterexample, accepted/rejected transitions, retained evidence, and the assurance limit.
Passing contract checks would not establish learning improvement.
Measured performance still requires frozen artifacts, complete trial accounting, declared selection, independent comparisons, and appropriately separated evaluation data.

## Verified primary references and citation scope

- **Williams (1992), Simple statistical gradient-following algorithms for connectionist reinforcement learning.** *Abstract:* Foundational statistical reward-gradient methods. *URL:* https://doi.org/10.1007/BF00992696. Scope: the REINFORCE lineage, not this optimizer configuration.
- **Sutton, McAllester, Singh, and Mansour (1999), Policy Gradient Methods for Reinforcement Learning with Function Approximation, NIPS 1999 / volume 12.** *Abstract:* Differentiable policy parameterization and gradients aided by action-value or advantage estimates. *URL:* https://papers.nips.cc/paper/1713-policy-gradient-methods-for-reinforcement-learning-with-function-approximation. Scope: policy-gradient foundations, not application-specific features or readiness.
- **Henderson et al., Deep Reinforcement Learning that Matters, v3 (30 January 2019).** *Abstract:* Reproducibility, variability, baseline comparisons, and experimental reporting. *URL:* https://arxiv.org/abs/1709.06560v3. Scope: reporting discipline, not an optimal seed count or budget.
- **Portelas et al., Automatic Curriculum Learning For Deep RL: A Short Survey, v2 (28 May 2020).** *Abstract:* Curriculum methods and motivations in deep reinforcement learning. *URL:* https://arxiv.org/abs/2003.04664v2. Scope: curriculum context, not endorsement of fixed allocations.
- **NumPy, Parallel random number generation.** *Abstract:* SeedSequence spawning, stream construction, Philox, and jumping. *URL:* https://numpy.org/doc/stable/reference/random/parallel.html. Scope: documented alternative stream mechanisms, not the custom 32-bit seed recipe.
- **SciPy, `scipy.optimize.check_grad`.** *Abstract:* Forward-difference gradient comparison and discrepancy norm. *URL:* https://docs.scipy.org/doc/scipy/reference/generated/scipy.optimize.check_grad.html. Scope: checking vocabulary and documented forward behavior, not central tolerances.
- **RFC 8785 (2020), JSON Canonicalization Scheme.** *Abstract:* Constrained deterministic JSON serialization for repeatable cryptographic operations. *URL:* https://www.rfc-editor.org/rfc/rfc8785. Scope: JCS requirements, not certification of a custom codec.
- **Node.js, Timers.** *Abstract:* Timer scheduling and callback timing limitations. *URL:* https://nodejs.org/api/timers.html. Scope: no exact callback timing guarantee, not proof of a supervisor's correctness.
- **W3C, PROV-Overview (30 April 2013).** *Abstract:* Interoperable provenance information about entities, activities, and producers. *URL:* https://www.w3.org/TR/prov-overview/. Scope: provenance vocabulary, not authenticity or execution certification.
