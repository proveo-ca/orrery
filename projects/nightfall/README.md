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

Next steps:
- Add proper house geometry
- Implement 4 cats using Navigation + simple state machines
- Connect nano models via WebLLM for cat "agentic" behavior
- Build heart rate UI + tension mechanics
- Add curtains, notes, doors as interactables
- 20-minute real-time timer + dawn reveal
