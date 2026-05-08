# Game Objectives

## Primary Victory Condition
*   **Nexus Seizure:** Gain administrative control over (or crash) the opponent's **Nexus** container.

## Secondary Victory Conditions
*   **Heartbeat Severance:** Disrupt the opponent's network traffic long enough (>1000ms) that their units fail to report to their Nexus, causing them to be flagged as dead.
*   **Resource Depletion:** Force the opponent's host to kill containers due to OOM (Out of Memory).

## Game Modes
*   **Single Player Simulation (v0.0.1):** Player vs Local AI. The "Opponent" runs on localhost in a separate Docker Network.
*   **1v1 Duel (Future):** Direct IP-to-IP conflict via Tailscale.
