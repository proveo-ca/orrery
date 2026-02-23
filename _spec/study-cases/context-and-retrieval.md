# Context Engineering & Retrieval Architectures

This document tracks key research papers and strategies for managing the Context Window and ensuring high-precision retrieval.

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
