Thinking of using https://godotengine.org/ for a hobby horror game. The essentials is:
 

1. 1st person
2. low-light low-res w/ light source
3. agentic reasoning for characters
4. collision aware (cannot spam run, details later)
5. actions based on vision
6. heart rate monitor of the main character

The plot is a teenager alone in a house whereas the family went away for one night. The main character wakes up 20mins before dawn, but the entire 3 story + basement house has blackout curtains, so the player won't know this. The objective is to survive 20mins in real time and open all curtains to reveal the paranormal activity is just a gang of 4 black stray cats causing trouble.Godot is an excellent choice for this hobby horror game. It's free, lightweight, has strong 3D support in Godot 4.x, and a great community with tons of tutorials and assets. Your concept sounds fun—a short, tense 20-minute real-time survival twist with a wholesome/cat reveal. Perfect scope for a hobby project.
Here's a breakdown of how to approach your essentials in Godot 4 (current stable as of 2026).
1. First-Person Controller
   Godot makes this straightforward with CharacterBody3D.

Use a CharacterBody3D + CollisionShape3D (capsule) + Camera3D (positioned at eye height ~1.6m).
Implement WASD movement, mouse look, jump, and sprint.
Many ready tutorials exist: Search for "Godot 4 first person controller" on YouTube. Popular ones include basic templates with inertia, headbob, and FOV sprint effects.

Collision-aware movement (no spam run):
Use move_and_slide() with velocity. Add stamina or a cooldown/delay on sprint. For "cannot spam run," implement acceleration/deceleration, ground friction, and perhaps a brief recovery period after sprinting. You can tie this to heart rate later.
2. Low-Light / Low-Res with Light Sources
   Perfect for horror atmosphere.

Lighting: Use OmniLight3D (lantern/flashlight) and SpotLight3D with shadows enabled. Add volumetric fog (FogVolume or environment fog) for thick darkness. Flicker lights with noise textures or AnimationPlayer for unease.
Low-res aesthetic: Use a SubViewport with lower resolution + nearest-neighbor filtering, or post-process shaders (pixelation, CRT, vignette, grain). Adjust WorldEnvironment for dark ambient + high contrast.
Player flashlight: Attach a SpotLight3D to the camera, with battery drain or limited use.

Blackout curtains: Simple meshes with a script to "open" them (toggle visibility, play animation, reveal light).
3. Agentic Reasoning for Characters (The 4 Black Cats)
   "Agentic" implies goal-driven, somewhat autonomous behavior. The cats cause "paranormal" chaos (knocking things, shadows, sounds) until curtains open.
   Recommended approaches (from simple to advanced):

State Machines — Built-in and sufficient. Each cat has states: Wander, Investigate Noise, Flee, Cause Mischief, Hide. Use @onready var state = WANDER and a _process switch.
Behavior Trees — Better for complex, modular AI. Use free/community addons like LimboAI (popular GDExtension) or Beehave. Great for "patrol → react to player vision/sound → knock object → run."
GOAP (Goal-Oriented Action Planning) — Overkill for 4 cats but very "agentic." There are proposals/addons; cats could plan actions like "find dark spot" → "make noise."

Cats as CharacterBody3D with simple navmesh navigation (NavigationAgent3D) for pathfinding around the house. Make them small, fast, and skittish—perfect for jump scares that resolve as cats.
Vision-based actions (point 5): Use RayCast3D or shape casts + Area3D for field of view. Cats react if they "see" the player (or player light) or hear footsteps.
4. Collision Aware
   Already covered in the controller. For cats: Proper collision layers so they bump into furniture/walls/player but can jump on surfaces. Use move_and_slide() for them too.
5. Actions Based on Vision

Player vision: Raycast from camera for interactions (open curtains, pick up items).
Cat vision: As above—Line of Sight (LOS) checks to trigger behaviors (e.g., freeze, run, knock vase if player is looking away).

Combine with sound: Footsteps or heart rate sounds can alert cats even without direct vision.
6. Heart Rate Monitor
   Great tension mechanic. Tie it to player actions (sprinting, hearing noises, seeing "ghosts"/cats).

UI: Use a Control node with Line2D or TextureProgressBar + labels. Animate a pulsing ECG line with sine waves or noise. There are forum examples for heartbeat visuals.
Logic: Variable current_bpm that increases with stress (sprint, fear events) and decays when calm. Visual/audio feedback (screen vignette, heavier breathing sounds). At high BPM: Screen shake, slower movement, or blur.

Timer for 20 real minutes: Use an in-game Timer node or Time.get_ticks_msec(). Dawn reveal at the end.
Additional Tips for Your Game

House Layout: 3 stories + basement. Use GridMap or imported scenes for rooms. NavigationMesh for cat AI pathfinding.
Audio is King in Horror: Creaking floors, distant meows that sound like moans, sudden crashes. Godot's audio buses for reverb/ducking.
Revelation: At 20 min or when all curtains open, switch cat "scare" animations/sounds to cute ones, lights turn on fully.
Scope Control: Start with one floor, basic player + 1 cat prototype. Expand.
Assets: Kenney.nl for free props, ambientCG/PolyHaven for textures/models. Low-poly fits low-res horror well.

Getting Started:

Download Godot 4.3+ from godotengine.org.
Follow a basic FPS controller tutorial.
Prototype player movement + one room with a cat using Behavior Tree or simple states.
Add lighting and heartbeat UI.

Godot has excellent documentation and an active Discord/forums. Your idea is very doable as a solo hobby project—short duration keeps it focused and finishable.
If you share more details (e.g., specific collision rules for running, cat behaviors, or a mechanic you're stuck on), I can give more targeted code snippets or architecture advice. Good luck; this has real potential to be a charming little horror gem! 🐱