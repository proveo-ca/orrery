import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useStore } from '../store';

const HALF_X = 12;
const HALF_Z = 12;
const HEIGHT = 5;
const WALL_T = 0.3;

type BoxDef = {
  center: [number, number, number];
  size: [number, number, number];
  matKey: 'wall' | 'ceil' | 'interior' | 'step';
  collide?: boolean;
};

// Layout matches the original House.ts exactly: shell + interior dividers + stairs.
const SHELL: BoxDef[] = [
  { center: [0, HEIGHT / 2, -HALF_Z], size: [HALF_X * 2, HEIGHT, WALL_T], matKey: 'wall' },
  { center: [0, HEIGHT / 2,  HALF_Z], size: [HALF_X * 2, HEIGHT, WALL_T], matKey: 'wall' },
  { center: [-HALF_X, HEIGHT / 2, 0], size: [WALL_T, HEIGHT, HALF_Z * 2], matKey: 'wall' },
  { center: [ HALF_X, HEIGHT / 2, 0], size: [WALL_T, HEIGHT, HALF_Z * 2], matKey: 'wall' },
  { center: [0, HEIGHT, 0], size: [HALF_X * 2, WALL_T, HALF_Z * 2], matKey: 'ceil' },
];

const INTERIOR: BoxDef[] = [
  { center: [-2, HEIGHT / 2, 4], size: [14, HEIGHT, WALL_T], matKey: 'interior' },
  { center: [5, HEIGHT / 2, 8], size: [WALL_T, HEIGHT, 8], matKey: 'interior' },
];

const STEPS: BoxDef[] = (() => {
  const stepCount = 6;
  const stepW = 3;
  const stepDepth = 0.4;
  const stepHeight = 0.18;
  const baseX = 9;
  const baseZ = -8;
  const out: BoxDef[] = [];
  for (let i = 0; i < stepCount; i++) {
    out.push({
      center: [baseX, stepHeight / 2 + i * stepHeight, baseZ + i * stepDepth],
      size: [stepW, stepHeight, stepDepth],
      matKey: 'step',
    });
  }
  return out;
})();

const ALL_BOXES = [...SHELL, ...INTERIOR, ...STEPS];

const SPAWN_POINTS = [
  // Player spawns at (0, 1.6, 0) facing -Z, so first spawn is intentionally
  // behind them and the rest are tucked behind dividers.
  new THREE.Vector3( 9, 0.6,  10),
  new THREE.Vector3(-9, 0.6,   9),
  new THREE.Vector3(-9, 0.6,  -9),
  new THREE.Vector3( 7, 0.6, -10),
];

const STAIR_LIGHT_TOP = { color: 0xff9966, intensity: 0.9, distance: 4.5, decay: 2, position: [9 - 1.6, 0.5, -8 + 6 * 0.4] as [number, number, number] };
const STAIR_LIGHT_BOTTOM = { color: 0xff7744, intensity: 0.7, distance: 3.5, decay: 2, position: [9 - 1.6, 0.35, -8 - 0.6] as [number, number, number] };

const MAT_PROPS: Record<BoxDef['matKey'], { color: number; roughness: number }> = {
  wall: { color: 0x222226, roughness: 0.95 },
  ceil: { color: 0x111114, roughness: 1 },
  interior: { color: 0x2a262a, roughness: 0.95 },
  step: { color: 0x1c1815, roughness: 0.9 },
};

export function House() {
  const colliders = useMemo(
    () =>
      ALL_BOXES.filter((b) => b.collide !== false).map((b) =>
        new THREE.Box3().setFromCenterAndSize(
          new THREE.Vector3(...b.center),
          new THREE.Vector3(...b.size),
        ),
      ),
    [],
  );

  useEffect(() => {
    const s = useStore.getState();
    s.setHouseColliders(colliders);
    s.setSpawnPoints(SPAWN_POINTS);
  }, [colliders]);

  return (
    <group>
      {ALL_BOXES.map((b, i) => (
        <mesh key={i} position={b.center} receiveShadow>
          <boxGeometry args={b.size} />
          <meshStandardMaterial {...MAT_PROPS[b.matKey]} />
        </mesh>
      ))}
      <pointLight {...STAIR_LIGHT_TOP} />
      <pointLight {...STAIR_LIGHT_BOTTOM} />
    </group>
  );
}
