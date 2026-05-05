import * as THREE from 'three';

const ray = new THREE.Ray();
const tmp = new THREE.Vector3();
const inflated = new THREE.Box3();

export class Vision {
  // Returns true iff the segment from→to is not blocked by any collider.
  // `inflate > 0` expands every AABB by that much before testing — use this
  // for path-clearance checks (cat body radius) so a "clear" segment actually
  // has room for the agent to walk. Use 0 for pure visual LOS.
  static hasLineOfSight(
    from: THREE.Vector3,
    to: THREE.Vector3,
    colliders: THREE.Box3[],
    inflate = 0,
  ): boolean {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const dz = to.z - from.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (dist < 1e-4) return true;

    ray.origin.copy(from);
    ray.direction.set(dx / dist, dy / dist, dz / dist);

    for (const box of colliders) {
      let target: THREE.Box3 = box;
      if (inflate > 0) {
        inflated.copy(box).expandByScalar(inflate);
        target = inflated;
      }
      const hit = ray.intersectBox(target, tmp);
      if (!hit) continue;
      const hx = hit.x - from.x;
      const hy = hit.y - from.y;
      const hz = hit.z - from.z;
      const hitDist = Math.sqrt(hx * hx + hy * hy + hz * hz);
      if (hitDist > 1e-3 && hitDist < dist - 1e-3) return false;
    }
    return true;
  }
}
