import * as THREE from 'three';

export type CatAnimationState =
  | 'STANDING'
  | 'WALKING'
  | 'RUNNING'
  | 'LAYING'
  | 'TURNING';

export class CatAnimator {
  private mixer: THREE.AnimationMixer;
  private actions: Map<CatAnimationState, THREE.AnimationAction> = new Map();
  private currentState: CatAnimationState = 'STANDING';
  private timeInState = 0;

  // Hysteresis: block transitions for this many seconds after entering a state.
  // Stops setState from being called every frame as Cat oscillates between bands.
  private readonly minTimeInState = 0.35;

  private readonly timeScales: Record<CatAnimationState, number> = {
    STANDING: 1.0,
    WALKING: 1.0,
    RUNNING: 1.8,
    LAYING: 1.0,
    TURNING: 1.0,
  };

  constructor(group: THREE.Group) {
    this.mixer = new THREE.AnimationMixer(group);
    this.createAnimations();
  }

  private createAnimations() {
    // Standing: a faint side-to-side sway on the body pivot (no vertical bob).
    const standingClip = new THREE.AnimationClip('standing', 1.6, [
      new THREE.QuaternionKeyframeTrack(
        '.quaternion',
        [0, 0.8, 1.6],
        [0, 0, 0, 1, 0, 0.02, 0, 1, 0, 0, 0, 1],
      ),
    ]);
    this.actions.set('STANDING', this.mixer.clipAction(standingClip));

    // Walking: subtle yaw wobble only — no position track, no vertical bob.
    const walkingClip = new THREE.AnimationClip('walking', 0.8, [
      new THREE.QuaternionKeyframeTrack(
        '.quaternion',
        [0, 0.4, 0.8],
        [0, 0, 0, 1, 0, 0.05, 0, 1, 0, 0, 0, 1],
      ),
    ]);
    this.actions.set('WALKING', this.mixer.clipAction(walkingClip));

    // Running: faster yaw wobble, still no vertical bob.
    const runningClip = new THREE.AnimationClip('running', 0.4, [
      new THREE.QuaternionKeyframeTrack(
        '.quaternion',
        [0, 0.2, 0.4],
        [0, 0, 0, 1, 0, 0.08, 0, 1, 0, 0, 0, 1],
      ),
    ]);
    this.actions.set('RUNNING', this.mixer.clipAction(runningClip));

    const layingClip = new THREE.AnimationClip('laying', 1.5, [
      new THREE.VectorKeyframeTrack('.scale', [0, 1.5], [1, 1, 1, 1, 0.3, 1]),
    ]);
    this.actions.set('LAYING', this.mixer.clipAction(layingClip));

    // Turning is a small look-over-shoulder body tilt. The actual heading change
    // is owned by Cat.ts via group.lookAt — this clip is visual flavor only,
    // intentionally subtle so a LoopRepeat cycle doesn't read as a snap-back.
    const turningClip = new THREE.AnimationClip('turning', 1.4, [
      new THREE.QuaternionKeyframeTrack(
        '.quaternion',
        [0, 0.7, 1.4],
        [0, 0, 0, 1, 0, 0.08, 0, 1, 0, 0, 0, 1],
      ),
    ]);
    this.actions.set('TURNING', this.mixer.clipAction(turningClip));

    const initial = this.actions.get(this.currentState);
    if (initial) initial.play().setEffectiveTimeScale(this.timeScales[this.currentState]);
  }

  setState(state: CatAnimationState) {
    if (this.currentState === state) return;
    if (this.timeInState < this.minTimeInState) return;

    const cur = this.actions.get(this.currentState);
    if (cur) cur.fadeOut(0.2);

    const next = this.actions.get(state);
    if (next) {
      next.reset().fadeIn(0.15).play().setEffectiveTimeScale(this.timeScales[state]);
    }

    this.currentState = state;
    this.timeInState = 0;
  }

  update(delta: number) {
    this.timeInState += delta;
    this.mixer.update(delta);
  }
}
