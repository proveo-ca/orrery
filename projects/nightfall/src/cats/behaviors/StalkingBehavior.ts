import * as THREE from 'three';

export class StalkingBehavior {
  // Sits above Cat's flee threshold (6) so flee and stalk don't both fire.
  private readonly idealMin = 8;
  private readonly idealMax = 18;
  private readonly speed = 5;

  execute(cat: THREE.Group, playerPos: THREE.Vector3, delta: number) {
    const dir = playerPos.clone().sub(cat.position);
    const dist = dir.length();

    if (dist > this.idealMax) {
      dir.normalize();
      cat.position.add(dir.multiplyScalar(this.speed * delta));
    } else if (dist < this.idealMin) {
      // Deterministic step away. Randomized perpendicular hiding lived here
      // and caused per-frame oscillation; HidingBehavior owns "find cover" now.
      dir.normalize();
      cat.position.add(dir.multiplyScalar(-this.speed * delta));
    }

    // Orientation is owned by Cat.ts (state-dependent: face player while
    // walking, face away while turning/fleeing). Don't lookAt here.
  }
}
