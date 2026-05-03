extends Node

signal curtain_opened(curtain_id: int)
signal player_made_noise(position: Vector3, intensity: float)
signal cat_alerted(cat_id: int, reason: String)

var curtains_opened := 0
var total_curtains := 4
var game_time := 0.0
var is_game_over := false

func _process(delta: float) -> void:
	if not is_game_over:
		game_time += delta

func open_curtain(curtain_id: int) -> void:
	curtains_opened += 1
	curtain_opened.emit(curtain_id)
	
	if curtains_opened >= total_curtains:
		_trigger_dawn_reveal()

func make_noise(position: Vector3, intensity: float = 1.0) -> void:
	player_made_noise.emit(position, intensity)

func _trigger_dawn_reveal() -> void:
	is_game_over = true
	# TODO: Switch to win scene / reveal cats are just cats
	print("All curtains opened! The cats are revealed!")
