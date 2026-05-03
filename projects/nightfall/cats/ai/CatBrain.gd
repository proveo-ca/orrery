extends Node
# CatBrain: agentic reasoning core. Stalking is now the PRIMARY action.
# Cats stalk the player from the shadows, react to vision/heart rate, cause mischief when safe.
# Later: integrate WebLLMConnector for dynamic decisions.

enum State { STALKING, WANDER, MISCHIEF, FLEE, HIDE }
var current_state: State = State.STALKING

func think(delta: float) -> void:
	match current_state:
		State.STALKING:
			# Main action: follow at distance, stay hidden, LOS/heart-rate aware
			var stalking = preload("res://cats/ai/behaviors/Stalking.gd").new()
			var player = get_tree().get_first_node_in_group("Player")
			stalking.execute(get_parent() as CharacterBody3D, player, delta)
		State.WANDER:
			# TODO: patrol using NavigationAgent3D
			pass
		State.MISCHIEF:
			# knock object, make noise (only when player not looking)
			pass
		State.FLEE:
			# run from player light/vision
			pass
		State.HIDE:
			# stay still in dark corner
			pass
