# Units & Buildings

## The Nexus (Main Building)
*   **Role:** The central command server and spawn point.
*   **Stats:** Grants **8 Population**.
*   **Respawn Mechanic:**
    *   Monitors the **1000ms Heartbeat**.
    *   On failure: Kills the ghost container (if reachable) and spins up a fresh Agent container at the Nexus coordinates.

## Docker Networks (The Expansion)
*   **Role:** Forward operating bases.
*   **Stats:** Grants **8 Population**.
*   **Summoning:** Upon completion of a new Network, a new Agent is immediately spawned (if population allows).
*   **Access:** An unit is considered "in the network" when it is physically attached to that Docker Bridge interface.

## The Agent (Mobile Unit)
*   **Cost:** **8 Population**.
*   **Constraint:** Max 4 Agents per player (32 Pop / 8 Cost).
*   **Composition:** A single Agent container runs multiple internal processes based on its role.

### 1. The Denier (Soldier - Brute Force)
*   **Unit Cost:** 1 Population.
*   **Squad Size:** 1 Agent Container = **8 Denier Processes**.
*   **Role:** Denial of Service / Overload.
*   **Attack:** Spams HTTP/TCP requests to target ports.

### 2. The Stalker (Soldier - Recon)
*   **Unit Cost:** 2 Population.
*   **Squad Size:** 1 Agent Container = **4 Stalker Processes**.
*   **Role:** Visibility & Counter-Stealth.
*   **Attack:** Port Scanning and Packet Sniffing.
*   **Special Ability:** **Reveal.** Can detect enemy units hiding on alternate ports.

### 3. The Worker (Economy)
*   **Unit Cost:** 1 Population.
*   **Squad Size:** 1 Agent Container = **8 Worker Processes**.
*   **Role:** Materializes invisible CPU/RAM into spendable "Energy" and "Matter."

## Stealth Mechanics
*   **Invisible:** Units configured to listen/transmit on randomized, non-standard ports are invisible to the standard map view.
*   **Visible:** Units on standard ports or those tagged by a Stalker.
