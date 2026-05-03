extends Node
# Curtains: blackout curtain logic — toggle open, emit to StateManager, reveal light
# Attach to MeshInstance curtain in House.tscn

@export var curtain_id := 0
var is_open := false

func interact(player: Node) -> void:
	if not is_open:
		is_open = true
		# TODO: play open animation, hide mesh or change material
		get_tree().get_first_node_in_group("StateManager").open_curtain(curtain_id)
		print("Curtain ", curtain_id, " opened")
