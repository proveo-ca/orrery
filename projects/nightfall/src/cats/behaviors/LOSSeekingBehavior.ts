import * as THREE from 'three';
import { Vision } from '../Vision';

const Y_AXIS = new THREE.Vector3(0, 1, 0);

// Angles sampled around the "toward player" direction (degrees). Symmetric so
// the cat doesn't bias one shoulder. Wide enough to discover doorways and
// step around dividers; finer near 0 to prefer direct routes when possible.
const PROBE_ANGLES = [0, 25, -25, 50, -50, 80, -80, 115, -115, 150, -150];

// Body radius used to inflate path checks so a "clear" segment actually has
// room for the cat to physically walk through.
const BODY_RADIUS = 0.55;
// Reward sticking with the previous heading. Significant enough to break
// ties between near-equal probes (which is what causes corner oscillation),
// but well below the +1000 LOS-gain bonus so real opportunities still win.
const CONSISTENCY_WEIGHT = 35;

export class LOSSeekingBehavior {
  private readonly speed = 4;
  private readonly probeDist = 2.8;
  private readonly eyeOffset = 0.95;
  private lastHeading: THREE.Vector3 | null = null;

  // Returns the chosen heading (XZ unit vector) so Cat.ts can orient toward
  // the path. Returns null when no probe is unobstructed and the cat is stuck.
  execute(
    cat: THREE.Group,
    playerEye: THREE.Vector3,
    delta: number,
    colliders: THREE.Box3[],
  ): THREE.Vector3 | null {
    const eye = cat.position.clone();
    eye.y += this.eyeOffset;

    const desired = new THREE.Vector3(
      playerEye.x - eye.x,
      0,
      playerEye.z - eye.z,
    );
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

      // Path the cat would walk must itself be unobstructed (inflated by body
      // radius so we don't pick paths that graze a wall).
      if (!Vision.hasLineOfSight(eye, probeEnd, colliders, BODY_RADIUS)) continue;

      const gainsLOS = Vision.hasLineOfSight(probeEnd, playerEye, colliders);
      const consistency = this.lastHeading
        ? (this.lastHeading.x * probe.x + this.lastHeading.z * probe.z) * CONSISTENCY_WEIGHT
        : 0;
      const score = (gainsLOS ? 1000 : 0) - Math.abs(angleDeg) + consistency;

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
