extends Node
# Interactable base: all objects player can raycast-interact with (curtains, notes, doors)
# Requires method "interact(player: Node)" 

func interact(_player: Node) -> void:
	push_error("interact() not implemented in subclass")
