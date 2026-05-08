# Map Generation: The Network Topology

## The "Terrain"
The map is a graph topology divided into two distinct zones.

1.  **Local Zone (Home):** Your host machine (Player Network).
2.  **The Void:** The connection layer (Simulated Bridge in v0.0.1).
3.  **Opponent Zone (Away):** The enemy territory.
    *   *v0.0.1:* A separate Docker Network on localhost running the AI simulation.
    *   *Future:* The enemy host machine via Tailscale.

## Map Elements

### 1. Jumpboxes (Movement Nodes)
*   **Definition:** Lightweight Alpine Linux containers acting as bridges.
*   **Movement:** "Moving" a unit on the grid technically means connecting that unit's container to a specific Jumpbox container's network interface.
*   **High Ground:** Represented by **Short-Path Jumpboxes**.
    *   *Low Ground:* Requires multiple hops (latency > 50ms).
    *   *High Ground:* Direct connection (latency < 10ms). Units here execute commands faster.

### 2. Docker Networks (Pylons)
*   **Function:** These act as the "power grid."
*   **Mechanic:** Units must be attached to a specific Docker Bridge Network to function. Expanding the map requires creating new Docker Networks (building "Pylons") to extend the reach of your agents.

### 3. Visibility (Fog of War)
*   **Default State:** You can see your own Jumpboxes and Networks.
*   **Invisible Resources:** Raw CPU and RAM are not visible on the map; they are only materialized when converted into Units or Buildings.
*   **Stealth:** Enemy units using non-standard ports are invisible on the map until revealed by a **Stalker**.
