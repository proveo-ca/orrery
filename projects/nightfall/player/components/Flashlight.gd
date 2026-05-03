extends Node
# Flashlight: toggle, battery drain, limited use for horror tension
@onready var light: SpotLight3D = $"../../Target/Camera/Flashlight"  # adjust path if needed

var battery := 100.0
var drain_rate := 2.0  # % per second when on

signal battery_low

func _process(delta: float) -> void:
	if light and light.visible and battery > 0:
		battery -= drain_rate * delta
		if battery <= 0:
			light.visible = false
			battery_low.emit()

func toggle() -> void:
	if light:
		light.visible = not light.visible
