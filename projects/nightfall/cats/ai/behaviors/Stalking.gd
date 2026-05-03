extends Node
# Stalking: primary cat action — follow player from safe distance,
# stay in shadows, react to line-of-sight / heart rate sounds.
# This is the core "agentic" behavior until player opens curtains.

func execute(cat: CharacterBody3D, player: Node3D, delta: float) -> void:
	if not player:
		return
	var to_player = (player.global_position - cat.global_position)
	var distance = to_player.length()
	
	if distance > 8.0:
		# pursue closer
		cat.velocity = to_player.normalized() * 2.5
	elif distance < 3.0:
		# too close — back off or hide
		cat.velocity = -to_player.normalized() * 2.0
	else:
		# ideal stalking distance — circle or pause
		cat.velocity = Vector3.ZERO
	
	# TODO: raycast from cat to player for LOS check
	# if LOS and player flashlight on -> FLEE or MISCHIEF
	cat.move_and_slide()
