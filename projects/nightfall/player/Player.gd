extends CharacterBody3D

@export var speed := 4.0
@export var sprint_multiplier := 1.6
@export var jump_velocity := 6.5
@export var mouse_sensitivity := 0.002

@onready var camera: Camera3D = $Target/Camera
@onready var flashlight: SpotLight3D = $Target/Camera/Flashlight
@onready var heart_rate = $HeartRate

var gravity = ProjectSettings.get_setting("physics/3d/default_gravity")
var is_sprinting := false
var flashlight_on := true

func _ready() -> void:
	Input.mouse_mode = Input.MOUSE_MODE_CAPTURED
	if heart_rate:
		heart_rate.current_bpm = 75

func _input(event: InputEvent) -> void:
	if event is InputEventMouseMotion and Input.mouse_mode == Input.MOUSE_MODE_CAPTURED:
		rotate_y(-event.relative.x * mouse_sensitivity)
		camera.rotate_x(-event.relative.y * mouse_sensitivity)
		camera.rotation.x = clamp(camera.rotation.x, -1.2, 1.2)
	
	if Input.is_action_just_pressed("flashlight"):
		flashlight_on = not flashlight_on
		flashlight.visible = flashlight_on
	
	if Input.is_action_just_pressed("interact"):
		_try_interact()

func _physics_process(delta: float) -> void:
	if not is_on_floor():
		velocity.y -= gravity * delta
	
	if Input.is_action_just_pressed("jump") and is_on_floor():
		velocity.y = jump_velocity
	
	is_sprinting = Input.is_action_pressed("sprint")
	var current_speed = speed * (sprint_multiplier if is_sprinting else 1.0)
	
	var input_dir = Input.get_vector("move_left", "move_right", "move_forward", "move_back")
	var direction = (transform.basis * Vector3(input_dir.x, 0, input_dir.y)).normalized()
	
	if direction:
		velocity.x = direction.x * current_speed
		velocity.z = direction.z * current_speed
	else:
		velocity.x = move_toward(velocity.x, 0, current_speed)
		velocity.z = move_toward(velocity.z, 0, current_speed)
	
	move_and_slide()
	
	# Increase heart rate when sprinting or in danger
	if heart_rate:
		if is_sprinting:
			heart_rate.current_bpm = lerp(heart_rate.current_bpm, 140.0, 0.1)
		else:
			heart_rate.current_bpm = lerp(heart_rate.current_bpm, 75.0, 0.05)

func _try_interact() -> void:
	# Raycast from camera for interaction (curtains, notes, doors)
	var space_state = get_world_3d().direct_space_state
	var query = PhysicsRayQueryParameters3D.create(camera.global_position, camera.global_position - camera.global_transform.basis.z * 3.0)
	var result = space_state.intersect_ray(query)
	if result and result.collider.has_method("interact"):
		result.collider.interact(self)
