extends Node
# StateManager: central game state for Nightfall horror prototype
# Tracks: game_time, curtains_opened, is_game_over, etc.
# Emits signals for UI and cat AI to react.

signal game_state_changed(new_state: String)
signal curtain_opened(curtain_id: int)
signal timer_updated(remaining: float)

var game_time := 0.0
var total_curtains := 4
var curtains_opened := 0
var is_game_over := false
var current_bpm := 75.0

func _process(delta: float) -> void:
	if not is_game_over:
		game_time += delta
		# TODO: 20 min real-time timer, dawn reveal

func open_curtain(id: int) -> void:
	curtains_opened += 1
	curtain_opened.emit(id)
	if curtains_opened >= total_curtains:
		_trigger_dawn()

func _trigger_dawn() -> void:
	is_game_over = true
	print("Dawn! All curtains open — cats revealed as cats.")
	# TODO: switch to cute mode, full lights, win screen

# Heart rate coupling (called from Player)
func adjust_heart_rate(delta_bpm: float) -> void:
	current_bpm = clamp(current_bpm + delta_bpm, 60.0, 180.0)
