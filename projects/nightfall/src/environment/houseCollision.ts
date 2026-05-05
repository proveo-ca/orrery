import * as THREE from 'three';

export function intersectsAABB(
  colliders: THREE.Box3[],
  pos: THREE.Vector3,
  radius: number,
  halfHeight: number,
): boolean {
  const aabb = new THREE.Box3(
    new THREE.Vector3(pos.x - radius, pos.y - halfHeight, pos.z - radius),
    new THREE.Vector3(pos.x + radius, pos.y + halfHeight, pos.z + radius),
  );
  for (const c of colliders) {
    if (c.intersectsBox(aabb)) return true;
  }
  return false;
}

// Per-axis resolution: revert X or Z independently if the move clips a wall.
export function resolveMoveXZ(
  colliders: THREE.Box3[],
  pos: THREE.Vector3,
  beforeX: number,
  beforeZ: number,
  radius: number,
  halfHeight: number,
) {
  const desiredX = pos.x;
  const desiredZ = pos.z;
  pos.x = desiredX;
  pos.z = beforeZ;
  if (intersectsAABB(colliders, pos, radius, halfHeight)) pos.x = beforeX;
  pos.z = desiredZ;
  if (intersectsAABB(colliders, pos, radius, halfHeight)) pos.z = beforeZ;
}
