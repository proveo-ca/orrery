import * as THREE from 'three';
import { Vision } from '../Vision';

const Y_AXIS = new THREE.Vector3(0, 1, 0);
const PROBE_ANGLES = [0, 25, -25, 50, -50, 80, -80, 115, -115, 150, -150];

// "Nowhere to hide" fallback: when the player gets too close and there's no
// cover, the cat dashes past them toward a point behind their back rather
// than straight retreating into a wall corner.
const BODY_RADIUS = 0.55;
const CONSISTENCY_WEIGHT = 35;

export class RunBehindBehavior {
  private readonly speed = 7;
  private readonly probeDist = 2.8;
  private readonly eyeOffset = 0.95;
  private readonly behindOffset = 5.5;
  private lastHeading: THREE.Vector3 | null = null;

  execute(
    cat: THREE.Group,
    playerEye: THREE.Vector3,
    playerForward: THREE.Vector3,
    delta: number,
    colliders: THREE.Box3[],
  ): THREE.Vector3 | null {
    const eye = cat.position.clone();
    eye.y += this.eyeOffset;

    const target = new THREE.Vector3(
      playerEye.x - playerForward.x * this.behindOffset,
      eye.y,
      playerEye.z - playerForward.z * this.behindOffset,
    );

    const desired = new THREE.Vector3(target.x - eye.x, 0, target.z - eye.z);
    if (desired.lengthSq() < 1e-4) return null;
    desired.normalize();

    let bestDir: THREE.Vector3 | null = null;
    let bestScore = -Infinity;

    for (const angleDeg of PROBE_ANGLES) {
      const probe = desired.clone().applyAxisAngle(Y_AXIS, angleDeg * Math.PI / 180);
      const probeEnd = new THREE.Vector3(
        eye.x + probe.x * this.probeDist,
        eye.y,
        eye.z + probe.z * this.probeDist,
      );

      if (!Vision.hasLineOfSight(eye, probeEnd, colliders, BODY_RADIUS)) continue;

      // Prefer probes whose endpoint lands closest to the behind-player target.
      const dx = probeEnd.x - target.x;
      const dz = probeEnd.z - target.z;
      const distToTarget = Math.sqrt(dx * dx + dz * dz);
      const consistency = this.lastHeading
        ? (this.lastHeading.x * probe.x + this.lastHeading.z * probe.z) * CONSISTENCY_WEIGHT
        : 0;
      const score = -distToTarget * 5 - Math.abs(angleDeg) + consistency;

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
