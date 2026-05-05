import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { useStore, type CatState } from '../store';
import { resolveMoveXZ } from '../environment/houseCollision';
import { Vision } from './Vision';
import { CatAnimator } from './CatAnimator';
import { StalkingBehavior } from './behaviors/StalkingBehavior';
import { HidingBehavior } from './behaviors/HidingBehavior';
import { LOSSeekingBehavior } from './behaviors/LOSSeekingBehavior';
import { RunBehindBehavior } from './behaviors/RunBehindBehavior';
import { tickCat, applyCatPhase, INITIAL_CAT_PHASE, type CatBehaviors, type CatTickCtx } from './catFSM';

const CAT_EYE_OFFSET = 0.95;
const RADIUS = 0.55;
const HALF_HEIGHT = 0.5;
const LOOK_DOT_THRESHOLD = 0.85;
const SEPARATION_MIN_DIST = 3.8;
const SEPARATION_MAX_FORCE = 0.6;

type Props = {
  id: string;
  spawn: THREE.Vector3;
};

export function Cat({ id, spawn }: Props) {
  const camera = useThree((s) => s.camera);
  const groupRef = useRef<THREE.Group>(null);
  const bodyRef = useRef<THREE.Group>(null);
  const animatorRef = useRef<CatAnimator | null>(null);

  // Behaviors hold per-cat state (e.g. HidingBehavior.lastHeading), so each
  // cat needs its own instances. Lazy-initialized once.
  const [behaviors] = useState<CatBehaviors>(() => ({
    stalking: new StalkingBehavior(),
    hider: new HidingBehavior(),
    losSeeker: new LOSSeekingBehavior(),
    runBehind: new RunBehindBehavior(),
  }));

  useEffect(() => {
    const group = groupRef.current;
    const body = bodyRef.current;
    if (!group || !body) return;
    group.position.copy(spawn);
    animatorRef.current = new CatAnimator(body);
    const initial: CatState = { id, group, phase: INITIAL_CAT_PHASE };
    useStore.getState().registerCat(initial);
    return () => {
      animatorRef.current = null;
    };
  }, [id, spawn]);

  useFrame((_, delta) => {
    const group = groupRef.current;
    const animator = animatorRef.current;
    if (!group || !animator) return;
    const cat = useStore.getState().cats[id];
    if (!cat) return;

    separate(group, id);

    const colliders = useStore.getState().houseColliders;
    const playerPos = camera.position;
    const playerForward = scratchForward;
    camera.getWorldDirection(playerForward);
    playerForward.y = 0;
    if (playerForward.lengthSq() > 1e-6) playerForward.normalize();

    const dist = group.position.distanceTo(playerPos);
    scratchEye.copy(group.position);
    scratchEye.y += CAT_EYE_OFFSET;
    const hasLOS = Vision.hasLineOfSight(scratchEye, playerPos, colliders);
    const isLooking = isPlayerLookingAtCat(group.position, playerPos, camera);

    const ctx: CatTickCtx = {
      dist,
      isLooking,
      hasLOS,
      playerPos,
      playerForward,
      colliders,
    };

    const beforeX = group.position.x;
    const beforeZ = group.position.z;

    const nextPhase = tickCat(cat.phase, ctx, delta);
    if (nextPhase !== cat.phase) useStore.getState().setCatPhase(id, nextPhase);

    const animState = applyCatPhase(group, nextPhase, ctx, behaviors, delta);
    animator.setState(animState);

    if (colliders.length) {
      resolveMoveXZ(colliders, group.position, beforeX, beforeZ, RADIUS, HALF_HEIGHT);
    }
    animator.update(delta);
  });

  // Inner `body` group is the mixer target — animator transforms must not
  // fight the world-space movement/lookAt happening on the outer group.
  return (
    <group ref={groupRef}>
      <group ref={bodyRef}>
        <mesh>
          <sphereGeometry args={[0.55, 16, 16]} />
          <meshStandardMaterial color={0x111111} roughness={0.9} />
        </mesh>
        <mesh position={[0, 0.85, 0.35]}>
          <sphereGeometry args={[0.38, 16, 16]} />
          <meshStandardMaterial color={0x111111} roughness={0.9} />
        </mesh>
        <mesh position={[-0.25, 1.3, 0.5]} rotation={[0.4, -0.5, 0]}>
          <coneGeometry args={[0.12, 0.28, 4]} />
          <meshStandardMaterial color={0x111111} roughness={0.9} />
        </mesh>
        <mesh position={[0.25, 1.3, 0.5]} rotation={[0.4, 0.5, 0]}>
          <coneGeometry args={[0.12, 0.28, 4]} />
          <meshStandardMaterial color={0x111111} roughness={0.9} />
        </mesh>
        <mesh position={[-0.18, 0.95, 0.83]}>
          <sphereGeometry args={[0.045, 8, 8]} />
          <meshStandardMaterial color={0xfff59d} emissive={0xfff59d} emissiveIntensity={2} />
        </mesh>
        <mesh position={[0.18, 0.95, 0.83]}>
          <sphereGeometry args={[0.045, 8, 8]} />
          <meshStandardMaterial color={0xfff59d} emissive={0xfff59d} emissiveIntensity={2} />
        </mesh>
        <mesh position={[-0.18, 0.95, 0.87]}>
          <sphereGeometry args={[0.018, 8, 8]} />
          <meshStandardMaterial color={0x111111} />
        </mesh>
        <mesh position={[0.18, 0.95, 0.87]}>
          <sphereGeometry args={[0.018, 8, 8]} />
          <meshStandardMaterial color={0x111111} />
        </mesh>
        <mesh position={[0, 0.4, -0.6]} scale={[0.3, 0.3, 1.2]}>
          <sphereGeometry args={[0.2, 8, 8]} />
          <meshStandardMaterial color={0x111111} roughness={0.9} />
        </mesh>
      </group>
    </group>
  );
}

const scratchForward = new THREE.Vector3();
const scratchEye = new THREE.Vector3();
const scratchSep = new THREE.Vector3();
const scratchDiff = new THREE.Vector3();

function isPlayerLookingAtCat(
  catPos: THREE.Vector3,
  playerPos: THREE.Vector3,
  camera: THREE.Camera,
): boolean {
  scratchDiff.copy(catPos).sub(playerPos).normalize();
  scratchForward.set(0, 0, -1).applyQuaternion(camera.quaternion);
  return scratchDiff.dot(scratchForward) > LOOK_DOT_THRESHOLD;
}

function separate(group: THREE.Group, selfId: string) {
  const cats = useStore.getState().cats;
  scratchSep.set(0, 0, 0);
  for (const [otherId, other] of Object.entries(cats)) {
    if (otherId === selfId || !other.group) continue;
    scratchDiff.copy(group.position).sub(other.group.position);
    const dist = scratchDiff.length();
    if (dist < SEPARATION_MIN_DIST && dist > 0.05) {
      const strength = (SEPARATION_MIN_DIST - dist) / SEPARATION_MIN_DIST;
      scratchDiff.normalize().multiplyScalar(strength * SEPARATION_MAX_FORCE);
      scratchSep.add(scratchDiff);
    }
  }
  if (scratchSep.lengthSq() > 0) group.position.add(scratchSep);
}
