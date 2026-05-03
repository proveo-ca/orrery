extends Node
# Inventory: simple item collection for notes, keys, etc.
var items: Array[String] = []

signal item_added(item_name: String)

func add_item(name: String) -> void:
	items.append(name)
	item_added.emit(name)
	print("Picked up: ", name)

func has_item(name: String) -> bool:
	return items.has(name)
