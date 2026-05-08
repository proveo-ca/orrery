# Resources & Economy

## Base Resources

### 1. Population (Supply Cap)
*   **Definition:** The logistical limit of how many heavy containers the host can manage.
*   **Maximum Cap:** 32 Population.
*   **Supply Sources:**
    *   **Nexus:** +8 Population.
    *   **Network (Expansion):** +8 Population per network.
*   **Unit Costs:**
    *   **Agent Container:** 8 Population (Base Unit).
    *   *Internal Breakdown:*
        *   **Denier:** 1 Population.
        *   **Worker:** 1 Population.
        *   **Stalker:** 2 Population.

### 2. Tokens (Intelligence)
*   **Definition:** API credits or local compute time allocated for LLM inference.
*   **Usage:** Every time an Agent needs to "think" (generate a bash script, analyze a scan result), it consumes Tokens.
*   **Generation:** Passive generation over time by the Nexus.

## The Invisible Economy (Hardware Constraints)
While Population and Tokens are the visible game currency, the physical hardware limits still apply:
*   **CPU:** Limits the speed of Denier attacks.
*   **RAM:** Limits the number of active containers (Population).
*   **Bandwidth:** Limits the reliability of the Heartbeat.
