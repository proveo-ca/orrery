# Minimum Specifications & Configuration

## Hardware Requirements by Mode

### 1. Single Player (v0.0.1 Target)
*   **Role:** Host runs **Player + Enemy + Enemy Brain**.
*   **RAM:** **32 GB Unified Memory** (Minimum).
    *   *Player Arena:* 8 GB (Docker Containers).
    *   *Enemy Arena:* 8 GB (Docker Containers).
    *   *Enemy Commander (LLM):* **8 GB** (Strategic AI Model - e.g., Llama-3-8B-Quantized).
    *   *Host OS/Overhead:* 8 GB.
*   **CPU:** **12 Cores** (Minimum).
    *   *Allocation:* 4 (Player Arena) + 4 (Enemy Arena) + 2 (Commander Inference) + 2 (OS).
*   **Agent Cap:** **2 Agents** per side (Total 4 active agents on host).

### 2. Multiplayer (Future Release)
*   **Role:** Host runs only **one side** of the simulation.
*   **RAM:** 16 GB Unified Memory.
*   **CPU:** 8 Cores.
*   **Agent Cap:** 4 Agents per Player.

## The "Game Arena" (Virtual Limits)
Regardless of physical hardware, the game engine enforces these limits per player to simulate scarcity:
*   **Max RAM:** 8 GB (Matter).
*   **Max CPU:** 4 Cores (Energy).

## AI Model Roster
*   **Single Player Note:** The host must run inference for *both* the player's agents and the enemy agents, PLUS the "Enemy Commander" strategy model.

### Primary Agent Model: Qwen2.5-Coder-1.5B-Instruct (Q4_K_M)
*   **Size:** ~1.0 GB Weights + ~500 MB Context.
*   **Usage:** Used by the individual units (Workers/Soldiers) to execute tasks.

### Enemy Commander Model (Single Player Only)
*   **Model:** **Llama-3-8B-Instruct (Q4_K_M)** or **Mistral-7B-Instruct**.
*   **Size:** ~5-6 GB Weights + ~2 GB Context.
*   **Role:** High-level strategy, resource management, and attack planning for the AI opponent.

## Critical Configuration for Parallelism
To run agents simultaneously, the **Context Window (KV Cache)** must be strictly limited in the runner (Ollama/llama.cpp):

*   **Max Context:** 4096 tokens per agent (Absolute Max).
*   **Recommendation:** 2048 tokens per agent.
