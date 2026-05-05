import * as THREE from 'three';
import { Vision } from '../Vision';

const Y_AXIS = new THREE.Vector3(0, 1, 0);

// Mirror of LOSSeekingBehavior's fan. Base direction is "away from player",
// so 0° = straight retreat. Excludes 180° (toward player — the opposite of hiding).
const PROBE_ANGLES = [0, 25, -25, 50, -50, 80, -80, 115, -115, 150, -150];

const BODY_RADIUS = 0.55;
const CONSISTENCY_WEIGHT = 35;

export class HidingBehavior {
  private readonly speed = 5;
  private readonly probeDist = 2.8;
  private readonly eyeOffset = 0.95;
  private lastHeading: THREE.Vector3 | null = null;

  // Picks a heading toward a position that breaks LOS to the player. Returns
  // the chosen unit vector (so Cat.ts can orient toward it), or null if every
  // probe is blocked by a wall.
  execute(
    cat: THREE.Group,
    playerEye: THREE.Vector3,
    delta: number,
    colliders: THREE.Box3[],
  ): THREE.Vector3 | null {
    const eye = cat.position.clone();
    eye.y += this.eyeOffset;

    const away = new THREE.Vector3(
      eye.x - playerEye.x,
      0,
      eye.z - playerEye.z,
    );
    if (away.lengthSq() < 1e-4) return null;
    away.normalize();

    let bestDir: THREE.Vector3 | null = null;
    let bestScore = -Infinity;

    for (const angleDeg of PROBE_ANGLES) {
      const probe = away.clone().applyAxisAngle(Y_AXIS, angleDeg * Math.PI / 180);
      const probeEnd = new THREE.Vector3(
        eye.x + probe.x * this.probeDist,
        eye.y,
        eye.z + probe.z * this.probeDist,
      );

      // Cat must be able to physically walk this segment (inflated by body radius).
      if (!Vision.hasLineOfSight(eye, probeEnd, colliders, BODY_RADIUS)) continue;

      const breaksLOS = !Vision.hasLineOfSight(probeEnd, playerEye, colliders);
      const consistency = this.lastHeading
        ? (this.lastHeading.x * probe.x + this.lastHeading.z * probe.z) * CONSISTENCY_WEIGHT
        : 0;
      const score = (breaksLOS ? 1000 : 0) - Math.abs(angleDeg) + consistency;

      if (score > bestScore) {
        bestScore = score;
        bestDir = probe;
      }
    }

    if (!bestDir) {
      this.lastHeading = null;
      return null;
    }

    const step = this.speed * delta;
    cat.position.x += bestDir.x * step;
    cat.position.z += bestDir.z * step;

    if (!this.lastHeading) this.lastHeading = new THREE.Vector3();
    this.lastHeading.set(bestDir.x, 0, bestDir.z);
    return bestDir;
  }
}
