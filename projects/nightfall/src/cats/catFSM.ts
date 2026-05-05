import * as THREE from 'three';
import type { CatPhase } from '../store';
import type { CatAnimationState } from './CatAnimator';
import type { StalkingBehavior } from './behaviors/StalkingBehavior';
import type { HidingBehavior } from './behaviors/HidingBehavior';
import type { LOSSeekingBehavior } from './behaviors/LOSSeekingBehavior';
import type { RunBehindBehavior } from './behaviors/RunBehindBehavior';

const FLEE_RADIUS = 6;
const FLEE_DURATION = 1.5;
const FLEE_SPRINT_MULT = 1.4;
const STARE_THRESHOLD = 1.5;
const HESITATE_MIN = 1;
const HESITATE_RANGE = 2;
// Exponential damping rate for rotation. Higher = snappier; lower = laggier
// but better at masking probe-selection flicker. k=10 → ~0.1s time constant.
const FACING_DAMP = 10;

export const INITIAL_CAT_PHASE: CatPhase = { kind: 'STALKING', lookedAtTime: 0 };

export type CatTickCtx = {
  dist: number;
  isLooking: boolean;
  hasLOS: boolean;
  playerPos: THREE.Vector3;
  playerForward: THREE.Vector3;
  colliders: THREE.Box3[];
};

export type CatBehaviors = {
  stalking: StalkingBehavior;
  hider: HidingBehavior;
  losSeeker: LOSSeekingBehavior;
  runBehind: RunBehindBehavior;
};

// Decide phase when no specific in-flight state forces our hand. Used as the
// fall-through after FLEEING/HESITATING/HIDING exit.
function decideRest(ctx: CatTickCtx): CatPhase {
  if (!ctx.hasLOS) return { kind: 'SEEKING_LOS' };
  return { kind: 'STALKING', lookedAtTime: 0 };
}

// Pure transition function. Returns the next phase given the current one and
// the per-frame context. Side effects (movement, animation) live in
// `applyCatPhase` — keep this side-effect-free so the FSM stays testable.
export function tickCat(phase: CatPhase, ctx: CatTickCtx, delta: number): CatPhase {
  // Close-range panic preempts everything. Refresh the timer every frame
  // we're inside the radius so the cat keeps fleeing while close.
  if (ctx.dist < FLEE_RADIUS) return { kind: 'FLEEING', remaining: FLEE_DURATION };

  switch (phase.kind) {
    case 'FLEEING': {
      const remaining = phase.remaining - delta;
      return remaining > 0 ? { kind: 'FLEEING', remaining } : decideRest(ctx);
    }
    case 'HESITATING': {
      // Gaze broken (player looked away or LOS lost) — exit cleanly. The
      // remaining-timer field ceases to exist, so there is nothing to reset.
      if (!(ctx.isLooking && ctx.hasLOS)) return decideRest(ctx);
      const remaining = phase.remaining - delta;
      return remaining > 0 ? { kind: 'HESITATING', remaining } : { kind: 'HIDING' };
    }
    case 'HESITATING_LOST': {
      // Player came back into view during the pause — abandon the seek.
      if (ctx.hasLOS) return { kind: 'STALKING', lookedAtTime: 0 };
      const remaining = phase.remaining - delta;
      return remaining > 0 ? { kind: 'HESITATING_LOST', remaining } : { kind: 'SEEKING_LOS' };
    }
    case 'HIDING': {
      // Mirrors the original "bolt only while watched" behavior: as soon as
      // the player looks away or LOS breaks, drop back to normal.
      if (!ctx.hasLOS || !ctx.isLooking) return decideRest(ctx);
      return phase;
    }
    case 'STALKING': {
      // Player slipped behind cover — pause before chasing. Mirrors the
      // HESITATING beat on the "spotted" side.
      if (!ctx.hasLOS) {
        return { kind: 'HESITATING_LOST', remaining: HESITATE_MIN + Math.random() * HESITATE_RANGE };
      }
      const lookedAtTime = ctx.isLooking ? phase.lookedAtTime + delta : 0;
      if (lookedAtTime > STARE_THRESHOLD) {
        return { kind: 'HESITATING', remaining: HESITATE_MIN + Math.random() * HESITATE_RANGE };
      }
      return { kind: 'STALKING', lookedAtTime };
    }
    case 'SEEKING_LOS': {
      if (ctx.hasLOS) return { kind: 'STALKING', lookedAtTime: 0 };
      return phase;
    }
  }
}

type Facing = 'PLAYER' | 'AWAY' | 'HEADING';

// Side-effect dispatcher. Mutates `group` (movement + facing) and returns the
// animation state the caller should hand to the animator. Behavior modules
// own their per-cat state (e.g. HidingBehavior.lastHeading), so callers must
// pass the same instances frame-to-frame.
export function applyCatPhase(
  group: THREE.Group,
  phase: CatPhase,
  ctx: CatTickCtx,
  bh: CatBehaviors,
  delta: number,
): CatAnimationState {
  let face: Facing;
  let anim: CatAnimationState;

  switch (phase.kind) {
    case 'STALKING':
      if (ctx.isLooking) {
        anim = 'STANDING';
      } else {
        bh.stalking.execute(group, ctx.playerPos, delta);
        anim = 'WALKING';
      }
      face = 'PLAYER';
      break;
    case 'HESITATING':
      anim = 'STANDING';
      face = 'PLAYER';
      break;
    case 'HESITATING_LOST':
      // Cat stares at the spot the player vanished from. Preserve whatever
      // facing was current — flagging HEADING skips the facing block below.
      anim = 'STANDING';
      face = 'HEADING';
      break;
    case 'HIDING': {
      const heading = bh.hider.execute(group, ctx.playerPos, delta, ctx.colliders);
      if (heading) {
        faceHeading(group, heading, delta);
        face = 'HEADING';
      } else {
        bh.stalking.execute(group, ctx.playerPos, delta);
        face = 'AWAY';
      }
      anim = 'RUNNING';
      break;
    }
    case 'FLEEING': {
      // Sprint multiplier only while inside the close-range radius — the
      // trail-off period uses normal speed, matching the original two-branch
      // implementation in Cat.ts.
      const fleeDelta = ctx.dist < FLEE_RADIUS ? delta * FLEE_SPRINT_MULT : delta;
      let heading = bh.hider.execute(group, ctx.playerPos, fleeDelta, ctx.colliders);
      if (!heading) {
        heading = bh.runBehind.execute(group, ctx.playerPos, ctx.playerForward, fleeDelta, ctx.colliders);
      }
      if (heading) {
        faceHeading(group, heading, delta);
        face = 'HEADING';
      } else {
        bh.stalking.execute(group, ctx.playerPos, fleeDelta);
        face = 'AWAY';
      }
      anim = 'RUNNING';
      break;
    }
    case 'SEEKING_LOS': {
      const heading = bh.losSeeker.execute(group, ctx.playerPos, delta, ctx.colliders);
      if (heading) {
        faceHeading(group, heading, delta);
        face = 'HEADING';
        anim = 'WALKING';
      } else {
        face = 'PLAYER';
        anim = 'STANDING';
      }
      break;
    }
  }

  if (face !== 'HEADING' && ctx.dist > 0.1) {
    facePlayerOrAway(group, ctx.playerPos, face, delta);
  }

  return anim;
}

function faceHeading(group: THREE.Group, heading: THREE.Vector3, delta: number) {
  smoothFaceXZ(
    group,
    group.position.x + heading.x,
    group.position.z + heading.z,
    delta,
  );
}

function facePlayerOrAway(group: THREE.Group, playerPos: THREE.Vector3, mode: 'PLAYER' | 'AWAY', delta: number) {
  if (mode === 'AWAY') {
    const tx = group.position.x * 2 - playerPos.x;
    const tz = group.position.z * 2 - playerPos.z;
    smoothFaceXZ(group, tx, tz, delta);
  } else {
    smoothFaceXZ(group, playerPos.x, playerPos.z, delta);
  }
}

// Damped yaw-only facing. Like group.lookAt but exponentially eases instead
// of snapping — alternating probe targets converge to the midpoint instead
// of visibly whipping back and forth.
//
// The cat's head/ears/eyes are at +Z in body-local space (tail at -Z), so
// "forward" for this geometry is +Z, not three.js's convention of -Z. The
// atan2(dx, dz) form points the model's +Z axis at the target — head first.
function smoothFaceXZ(group: THREE.Group, x: number, z: number, delta: number) {
  const dx = x - group.position.x;
  const dz = z - group.position.z;
  if (dx * dx + dz * dz < 1e-8) return;
  const targetYaw = Math.atan2(dx, dz);
  let diff = targetYaw - group.rotation.y;
  while (diff > Math.PI) diff -= 2 * Math.PI;
  while (diff < -Math.PI) diff += 2 * Math.PI;
  group.rotation.y += diff * (1 - Math.exp(-FACING_DAMP * delta));
}
