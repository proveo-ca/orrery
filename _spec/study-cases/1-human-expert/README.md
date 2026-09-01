# Level 1 — Human expert

The capability-ladder **floor**: work a domain expert chooses, designs, or signs off. Diagrams here are
foundational craft — not harness prompts, not weight updates.

| Folder | What it distills |
| --- | --- |
| [`computer-science/`](./computer-science/) | ADTs + algorithm families from [proveo-ca/computer-science](https://github.com/proveo-ca/computer-science) primers (`libs/datatypes`, `libs/algorithms`, `apps/cache-strategies`) |
| [`machine-learning/`](./machine-learning/) | Pre-LLM ML primers in nine families — `svm/`, `neural-networks/`, `trees-and-ensembles/`, `clustering-and-dimred/`, `optimization/`, `rating-systems/`, `game-search/`, `imperfect-information-games/`, `reinforcement-learning/` |
| [`rag/`](./rag/) | Retrieval-architecture selection map as of **July 2026** (vector, graph, tree, vectorless, adaptive) |

Each content `.puml` carries `' Level: 1` and a `' URL:` per
[`../CONTRIBUTING.md`](../CONTRIBUTING.md); `_primer.puml` metafiles are source-exempt.

## Why pre-LLM ML is Level 1, not Level 2

Level 2 is *one crafted prompt or reusable skill* — an SVM has no prompt, so the tier does not apply.
These files sit in the same slot as `computer-science/`: **the practitioner's own craft**, authored as
primers. Nothing here is a prompt (L2), a scaffold around a frozen model (L4), or a weight update to a
pretrained one (L5–L6).

Two boundaries the tree deliberately draws:

- **`rag/` is a sibling of `machine-learning/`, not a child.** GraphRAG, RAPTOR and CRAG are LLM-era
  retrieval architectures; filing them beside SVM as "pre-LLM" would misdescribe them.
- **Classical RL is L1; RL against a pretrained model's weights is L6.** `reinforcement-learning/`
  carries the primers and cross-links down to
  [`6-post-training/`](../6-post-training/) rather than duplicating it.
