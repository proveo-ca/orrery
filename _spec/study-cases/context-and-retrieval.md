# Context Engineering & Retrieval Architectures

This document tracks key research papers and strategies for managing the Context Window and ensuring high-precision retrieval — moving from inference-time prompting and pipelines through to systems that train or self-evolve their own retrieval.

> **Level-1 RAG map (Jul 2026).** Architecture selection diagrams (vector, GraphRAG, LightRAG, HippoRAG/2, PathRAG, RAPTOR, PageIndex, CRAG, KET-RAG, LazyGraphRAG, OG-RAG, adaptive routing) live under [`1-human-expert/rag/`](./1-human-expert/rag/). Foundational CS primers distilled from [proveo-ca/computer-science](https://github.com/proveo-ca/computer-science) are in [`1-human-expert/computer-science/`](./1-human-expert/computer-science/).

## 1. Context Window Management

Strategies for dealing with massive context limits (100k - 1M+ tokens) and the "Lost in the Middle" phenomenon.

*   **Lost in the Middle: How Language Models Use Long Contexts**
    *   *Abstract:* Performance degrades when relevant information is in the middle of a long context window. Models are best at using info at the start/end.
    *   *URL:* https://arxiv.org/abs/2307.03172
*   **Thread of Thought: Unraveling Chaotic Contexts**
    *   *Abstract:* Techniques to segment context to prevent confusion when multiple topics are present.
    *   *URL:* https://arxiv.org/abs/2311.08734
*   **LongLoRA: Efficient Fine-tuning of Long-Context Large Language Models**
    *   *Abstract:* Architecture for shifting attention in massive context windows.
    *   *URL:* https://arxiv.org/abs/2309.12307

## 2. High-Precision Retrieval (Finance / Legal)

Strategies for domains where hallucinations are unacceptable and retrieval needs to be atomic.

*   **Dual-Channel Retrieval (Fact vs. Rule RAG):**
    *   *Concept:* Maintains two distinct context pipelines: Pipeline A retrieves factual state (e.g., client financial history), while Pipeline B retrieves systemic constraints (e.g., SEC regulations or legal statutes).
    *   *Implementation:* Constraints from Pipeline B are injected into the system prompt as absolute, overriding directives (hard prompt guardrails) rather than appended as standard conversational context, enforcing compliance during generation.
*   **Dense X Retrieval: What Retrieval Granularity Should We Use?**
    *   *Abstract:* Argues for "Proposition Retrieval" (atomic facts) over document/paragraph retrieval to minimize noise and improve accuracy.
    *   *URL:* https://arxiv.org/abs/2312.06648
*   **RAG vs. Long Context: The "Needle in a Haystack" Analysis**
    *   *Abstract:* A comparative analysis showing RAG often outperforms massive context windows for specific fact retrieval.
    *   *URL:* https://arxiv.org/abs/2402.13249

## 3. Verification & Anti-Hallucination

*   **Chain-of-Verification (CoVe): Reducing Hallucination in Large Language Models**
    *   *Abstract:* A prompting pattern where the model generates a plan to verify its own answers against retrieved context.
    *   *URL:* https://arxiv.org/abs/2309.11495
*   **Self-RAG: Learning to Retrieve, Generate, and Critique through Self-Reflection** (Oct 2023)
    *   *Abstract:* A framework where the model learns to output special tokens to critique its own retrieval quality and generation accuracy during inference.
    *   *URL:* https://arxiv.org/abs/2310.11511
*   **Corrective RAG (CRAG): Enhancing Retrieval-Augmented Generation** (Jan 2024)
    *   *Abstract:* Introduces a lightweight "retrieval evaluator" to assess the quality of retrieved documents. If quality is low, it falls back to a web search to correct the context.
    *   *URL:* https://arxiv.org/abs/2401.15884
*   **Localizing and Correcting Errors for LLM-based Planners (L-ICL)** (Feb 2026)
    *   *Abstract:* Proposes iteratively augmenting instructions with targeted corrections for specific failing steps (minimal input-output examples) rather than full trajectories. Shows that localized corrections are more effective and sample-efficient than retrieval-based ICL for planning tasks.
    *   *URL:* https://arxiv.org/abs/2602.00276

*   **ChatEval: Towards Better LLM-based Evaluators through Multi-Agent Debate** (Aug 2023)
    *   *Abstract:* Explores using multiple LLM instances (a "Drafter" and a "Red-Team Judge") to debate a response, significantly improving evaluation quality and bridging the gap to human-level evaluation without real-world execution.
    *   *URL:* https://arxiv.org/abs/2308.07201
*   **On the Limit of Language Models as Planning Formalizers** (Dec 2024)
    *   *Abstract:* Demonstrates that LLMs struggle to create executable plans autonomously, but excel at generating formal representations (e.g., PDDL) that can be deterministically solved to verify correctness in non-executable environments.
    *   *URL:* https://arxiv.org/abs/2412.09879

## 4. Learned & Self-Improving Retrieval

Where §1–§3 engineer context at *inference* time — prompting and pipelines around a fixed model — these systems instead **train the search/retrieval policy** or **self-evolve the context** against a reward or eval signal. Retrieval stops being plumbing and becomes something the model learns.

*   **Search-R1: Training LLMs to Reason and Leverage Search Engines with Reinforcement Learning** (Mar 2025)
    *   *Abstract:* Trains an LLM end-to-end with RL to interleave reasoning with live search-engine calls, learning *when* and *what* to retrieve from outcome rewards — replacing a fixed RAG pipeline with a learned retrieval policy.
    *   *URL:* https://arxiv.org/abs/2503.09516
*   **DeepRetrieval: Hacking Real Search Engines and Retrievers with LLMs via Reinforcement Learning** (Mar 2025)
    *   *Abstract:* Treats query generation as an RL policy optimized directly against real search engines/retrievers; the model learns to write queries that maximize retrieval quality, with no labeled query–document pairs.
    *   *URL:* https://arxiv.org/abs/2503.00223
*   **ReSearch: Learning to Reason with Search for LLMs via Reinforcement Learning** (NeurIPS 2025)
    *   *Abstract:* RL makes search an integral step of the reasoning chain; self-correction and reflection emerge from the reward. Peer-reviewed anchor for RL-reasoning-with-search.
    *   *URL:* https://arxiv.org/abs/2503.19470
*   **R1-Searcher++: Incentivizing the Dynamic Knowledge Acquisition of LLMs via Reinforcement Learning** (May 2025)
    *   *Abstract:* RL for *dynamic* retrieval plus a memorization mechanism that assimilates retrieved facts into the model's internal knowledge — a self-improving memory loop. (Successor to R1-Searcher, https://arxiv.org/abs/2503.05592.)
    *   *URL:* https://arxiv.org/abs/2505.17005
*   **Agentic Context Engineering (ACE): Evolving Contexts for Self-Improving Language Models** (ICLR 2026)
    *   *Abstract:* Self-improves the *context/playbook itself* via a generate → reflect → curate loop driven by execution feedback — gradient-free context evolution: no weight updates, but a reward-shaped self-improvement loop.
    *   *URL:* https://arxiv.org/abs/2510.04618

> **Bridge from §3.** *Self-RAG* (https://arxiv.org/abs/2310.11511) sits between the two halves of this document: its self-critique is a **learned** behavior — the model is *trained* to emit reflection tokens (Retrieve / IsRel / IsSup / IsUse) rather than prompted to — yet that training is supervised fine-tuning / distillation, **not** RL. A learned, but not reward-optimized, self-reflection.
