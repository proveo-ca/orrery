# Nightfall

A short real-time horror game made in Godot 4 for browser.
You play as a teenager who wakes up 20 minutes before dawn in a completely dark house.
Your goal: survive and open all the curtains.
The "paranormal" activity turns out to be four very mischievous black cats.

## Current Status
- First-person controller (from kinematic_character demo, adapted for Mobile renderer)
- Basic heart rate system stub
- Flashlight toggle (F)
- Interaction raycast ready (E)
- Central GameManager with signals for events
- Dark environment setup optimized for Mobile/Web

## How to Run Locally (Development)

1. Download **Godot 4.3 or newer** (Godot 4.4+ recommended) from https://godotengine.org/download
2. Make sure you download the **Standard** version (not Mono or .NET)
3. Open Godot Editor
4. Click **"Import"** and select the `project.godot` file in this folder
5. Once the project opens, press **F5** (or click the Play button at the top-right) to run the game

### Controls
- **WASD** — Move
- **Mouse** — Look around
- **Space** — Jump
- **Shift** — Sprint
- **F** — Toggle flashlight
- **E** — Interact (with notes, doors, curtains, etc.)

### Next Development Steps
- Add proper house geometry
- Implement 4 cats using Navigation + simple state machines
- Connect nano models via WebLLM for cat "agentic" behavior
- Build heart rate UI + tension mechanics
- Add curtains, notes, doors as interactables
- 20-minute real-time timer + dawn reveal

## Web Export (Browser)

To test the final browser version:
1. In Godot Editor, go to **Project > Export**
2. Select **Web** platform
3. Export the project
4. Open the generated `index.html` in a browser that supports WebGPU (Chrome/Edge recommended)

**Note:** WebLLM (nano models for cat AI) will only work in a WebGPU-compatible browser.
