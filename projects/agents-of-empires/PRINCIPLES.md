# Agents of Empires: Core Principles

## 1. The Reality-Game Bridge
*   **Local Resources as Assets:** The game maps actual host hardware to game resources.
*   **Hard Disk as Territory:** The map contains **3 Bases** per player (1 Active Nexus + 2 Hidden Sectors). Players must explore Jumpboxes to "find" these empty sectors on their own hard disk to expand.
*   **Docker as Entities:** Every game unit, building, or agent exists as a distinct Docker container.
*   **Network as Battlefield:** Connectivity is established via Docker Networks (and eventually Tailscale).

## 2. The Hardware Economy
*   **The Arena Limit:** The game is played within a strict sandbox of **8GB RAM** and **4 CPU Cores**.
*   **Consumption:** Every Unit (Agent) and Building (Nexus/Network) consumes a specific slice of this RAM/CPU pie.
*   **The Cap:** You can build as many buildings as you want *until you run out of RAM*.
*   **Agent Hard Cap:** Regardless of free RAM, you may never have more than **4 Active Agents** (due to AI Model interference).

## 3. Game Modes
*   **Single Player (v0.0.1 Target):** One host simulates the entire conflict.
    *   *Constraint:* Requires **32GB RAM** / **12 Cores**.
    *   *The Enemy Commander:* An **8GB LLM instance** runs in the background to simulate the opponent's strategic decisions (The "Brain").
    *   *Nerf:* Agent Cap reduced to **2 Agents** per side to maintain stability.
*   **Multiplayer (Future Release):** Two hosts connect via Tailscale. Each host manages 4 Agents.

## 4. The Cycle of Life (Heartbeat)
*   **The Pulse:** Every unit must report to the Nexus every 100ms.
*   **Death:** If a unit fails to report for **1000ms** (due to network severance or crash), the Nexus acknowledges it as "Dead."
*   **Rebirth:** The Nexus automatically **re-creates (respawns)** the dead unit container back at the Home Base after a penalty timer.

## 5. Victory Condition
*   **Seizure:** The objective is to gain root/admin access to the opponent's "Command Center" container or deplete their resource pool.
