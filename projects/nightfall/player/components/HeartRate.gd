extends Node
# HeartRate component: tracks BPM, drives UI and player effects
@export var current_bpm := 75.0
@export var max_bpm := 180.0

signal bpm_changed(new_bpm: float)

func increase(delta: float) -> void:
	current_bpm = clamp(current_bpm + delta, 60.0, max_bpm)
	bpm_changed.emit(current_bpm)

func decrease(delta: float) -> void:
	current_bpm = clamp(current_bpm - delta, 60.0, max_bpm)
	bpm_changed.emit(current_bpm)
