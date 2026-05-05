import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';
import { useStore } from '../store';
import { resolveMoveXZ } from '../environment/houseCollision';
import { getMobile } from './mobile';

const STICK_DEADZONE = 0.12;
const LOOK_SPEED = 2.5;
const PITCH_LIMIT = Math.PI / 2 - 0.01;

const RADIUS = 0.35;
const HALF_HEIGHT = 0.9;

export function Player() {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);

  const controlsRef = useRef<PointerLockControls | null>(null);
  const flashlightRef = useRef<THREE.SpotLight | null>(null);
  const keysRef = useRef(new Set<string>());
  const velocityRef = useRef(new THREE.Vector3());
  const lookEulerRef = useRef(new THREE.Euler(0, 0, 0, 'YXZ'));
  const raycasterRef = useRef(new THREE.Raycaster());

  // Flashlight as a child of the camera — follows look dir without per-frame work.
  useEffect(() => {
    const light = new THREE.SpotLight(0xfff4d6, 2, 14, Math.PI * 0.3, 0.4);
    light.castShadow = true;
    light.position.set(0, -0.3, 0);
    light.target.position.set(0, -0.3, -1);
    camera.add(light);
    camera.add(light.target);
    flashlightRef.current = light;
    return () => {
      camera.remove(light);
      camera.remove(light.target);
      flashlightRef.current = null;
    };
  }, [camera]);

  useEffect(() => {
    const controls = new PointerLockControls(camera, gl.domElement);
    controlsRef.current = controls;
    return () => {
      controls.disconnect();
      controlsRef.current = null;
    };
  }, [camera, gl]);

  useEffect(() => {
    const onKeydown = (e: KeyboardEvent) => {
      if (e.code === 'KeyQ' && !e.repeat && flashlightRef.current) {
        flashlightRef.current.visible = !flashlightRef.current.visible;
      }
      keysRef.current.add(e.code);
    };
    const onKeyup = (e: KeyboardEvent) => {
      keysRef.current.delete(e.code);
    };
    window.addEventListener('keydown', onKeydown);
    window.addEventListener('keyup', onKeyup);
    return () => {
      window.removeEventListener('keydown', onKeydown);
      window.removeEventListener('keyup', onKeyup);
    };
  }, []);

  useEffect(() => {
    const dom = gl.domElement;
    const mobile = getMobile();
    const tryInteract = () => {
      raycasterRef.current.setFromCamera(new THREE.Vector2(0, 0), camera);
      const hits = raycasterRef.current.intersectObjects(scene.children, true);
      for (const hit of hits) {
        const fn = hit.object.userData.onInteract as (() => void) | undefined;
        if (typeof fn === 'function') {
          fn();
          return;
        }
      }
    };
    const onClick = () => {
      const controls = controlsRef.current;
      if (mobile.enabled) {
        tryInteract();
        return;
      }
      if (controls && !controls.isLocked) {
        controls.lock();
        return;
      }
      tryInteract();
    };
    dom.addEventListener('click', onClick);
    return () => dom.removeEventListener('click', onClick);
  }, [camera, gl, scene]);

  useFrame((_, delta) => {
    const controls = controlsRef.current;
    if (!controls) return;
    const keys = keysRef.current;
    const mobile = getMobile();

    const sprint = keys.has('ShiftLeft');
    const targetSpeed = sprint ? 7 : 4.5;
    const accel = sprint ? 18 : 12;
    const friction = 8;

    const moveDir = new THREE.Vector3();
    if (keys.has('KeyW')) moveDir.z -= 1;
    if (keys.has('KeyS')) moveDir.z += 1;
    if (keys.has('KeyA')) moveDir.x -= 1;
    if (keys.has('KeyD')) moveDir.x += 1;

    if (mobile.enabled) {
      const sx = Math.abs(mobile.moveX) < STICK_DEADZONE ? 0 : mobile.moveX;
      const sy = Math.abs(mobile.moveY) < STICK_DEADZONE ? 0 : mobile.moveY;
      moveDir.set(sx, 0, sy);

      const lx = Math.abs(mobile.lookX) < STICK_DEADZONE ? 0 : mobile.lookX;
      const ly = Math.abs(mobile.lookY) < STICK_DEADZONE ? 0 : mobile.lookY;
      if (lx !== 0 || ly !== 0) {
        const e = lookEulerRef.current;
        e.setFromQuaternion(camera.quaternion);
        e.y -= lx * LOOK_SPEED * delta;
        e.x -= ly * LOOK_SPEED * delta;
        if (e.x > PITCH_LIMIT) e.x = PITCH_LIMIT;
        else if (e.x < -PITCH_LIMIT) e.x = -PITCH_LIMIT;
        camera.quaternion.setFromEuler(e);
      }
    }

    const v = velocityRef.current;
    if (moveDir.lengthSq() > 0) {
      moveDir.normalize();
      v.x = THREE.MathUtils.lerp(v.x, moveDir.x * targetSpeed, accel * delta);
      v.z = THREE.MathUtils.lerp(v.z, moveDir.z * targetSpeed, accel * delta);
    } else {
      v.x = THREE.MathUtils.lerp(v.x, 0, friction * delta);
      v.z = THREE.MathUtils.lerp(v.z, 0, friction * delta);
    }

    const beforeX = camera.position.x;
    const beforeZ = camera.position.z;
    controls.moveRight(v.x * delta);
    controls.moveForward(-v.z * delta);

    const colliders = useStore.getState().houseColliders;
    if (colliders.length) {
      resolveMoveXZ(colliders, camera.position, beforeX, beforeZ, RADIUS, HALF_HEIGHT);
    }

    useStore.getState().bumpBpm((sprint ? 12 : -4) * delta);
  });

  return null;
}
