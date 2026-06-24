# Minimum System Requirements

This project runs a fully localized AI Chess Coach, including a web UI, a Bun server (REST API + in-process orchestration), and a local LLM, all containerized via Docker.

## Hardware Requirements

*   **Processor:** Apple Silicon (M1/M2/M3/M4) or equivalent modern x86 CPU.
*   **Memory (RAM):** 16GB Unified Memory (Minimum).
*   **Storage:** ~15GB free space (Docker images + LLM weights).

## Software Requirements

*   **OS:** macOS 13+, Linux, or Windows (WSL2).
*   **Containerization:** Docker Desktop or OrbStack (OrbStack highly recommended for Mac users for lower memory overhead).

## Local LLM Specifications

To fit within the 16GB memory budget alongside the application containers, the system is tuned for the following LLM configuration:

*   **Recommended Model:** `Qwen 2.5 7B Instruct`
*   **Quantization:** 4-bit (e.g., `q4_K_M` via Ollama or vLLM)
*   **Model RAM Footprint:** ~4.7 GB
*   **Max Context Window (Inputs):** ~8,192 to 16,384 tokens. 
    *   *Note:* The chess harness (FEN + PGN history + coaching prompts) typically consumes less than 2,000 tokens per turn, leaving plenty of headroom for the KV cache.

## Memory Budget Breakdown (16GB Total)

If you are experiencing out-of-memory (OOM) kills, ensure your Docker resource limits align with this expected distribution:

1.  **Host OS (macOS/Linux):** ~4 GB
2.  **Docker Engine / VM:** ~2 GB
3.  **App Container (UI + Bun server):** ~1.5 GB
4.  **LLM Container (Weights + KV Cache):** ~8.5 GB
