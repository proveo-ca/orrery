extends CharacterBody3D
# Cat: reusable black cat template (CharacterBody3D + nav + state)
# Uses CatBrain for decisions (state machine or behavior tree later)

@onready var brain = $CatBrain

func _physics_process(delta: float) -> void:
	if brain:
		brain.think(delta)
	# TODO: move_and_slide() based on brain output
