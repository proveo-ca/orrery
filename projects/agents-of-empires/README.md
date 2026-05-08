# Agents of Empires

> **⚠️ Current Status (v0.0.1):** This project is currently in the **Single Player Prototype** phase. The initial release focuses on a Local Simulation where the player competes against a locally hosted AI opponent. Multiplayer (P2P via Tailscale) is planned for future releases.

**Agents of Empires** is a decentralized Real-Time Strategy (RTS) game where your local hardware resources become game assets. The objective is to seize the assets of the opponent using autonomous AI agents running in Docker containers.

## Documentation Index

### Core Foundation
*   [x] **[PRINCIPLES.md](PRINCIPLES.md)**: The core philosophy, the "Reality-Game Bridge," and victory conditions.
*   [x] **[MINIMUM_SPECS.md](MINIMUM_SPECS.md)**: Hardware requirements for the v0.0.1 Single Player simulation.

### Game Mechanics (Planning Phase)
*   [x] **[OBJECTIVES.md](OBJECTIVES.md)**: Detailed victory conditions and game modes.
*   [x] **[MAP_GENERATION.md](MAP_GENERATION.md)**: How local hardware and network topology translate into the game map.
*   [x] **[UNITS.md](UNITS.md)**: Definitions of Agents (Workers, Soldiers, Researchers) and Buildings.
*   [x] **[RESOURCES.md](RESOURCES.md)**: The economy system mapping CPU/RAM/Storage to game currency.
*   [x] **[STRATEGIES.md](STRATEGIES.md)**: Advanced tactics, Port Hopping, and Heartbeat manipulation.
*   [x] **[SECURITY_CONCEPTS.md](SECURITY_CONCEPTS.md)**: Gamified encryption, Key Hunting, and Honeypots.

### Architecture & Specs
*   [x] **[../../_spec/agents-of-empires/components.puml](../../_spec/agents-of-empires/components.puml)**: High-level component diagram (Single Player Architecture).
*   [x] **[../../_spec/agents-of-empires/tech_stack.puml](../../_spec/agents-of-empires/tech_stack.puml)**: Deployment diagram showing the "Docker-out-of-Docker" architecture and Go Launcher.
