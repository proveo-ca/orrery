import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { useStore } from '../store';

type Props = {
  position: [number, number, number];
  id: number;
};

// Pointer-lock-friendly interaction: Player.tsx raycasts from screen center on
// click and invokes whatever `onInteract` callback is stashed in userData. We
// keep that contract instead of using R3F's onClick because the cursor is
// locked and onClick would raycast from the locked screen position.
export function Curtain({ position, id }: Props) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [isOpen, setIsOpen] = useState(false);
  const isOpenRef = useRef(isOpen);
  isOpenRef.current = isOpen;

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    mesh.userData.onInteract = () => {
      if (isOpenRef.current) return;
      setIsOpen(true);
      useStore.getState().openCurtain();
      console.log(`Curtain ${id} opened`);
    };
    return () => {
      delete mesh.userData.onInteract;
    };
  }, [id]);

  return (
    <mesh ref={meshRef} position={position}>
      <planeGeometry args={[2, 3]} />
      <meshStandardMaterial
        color={isOpen ? 0x3a2f1f : 0x1a1a1a}
        side={THREE.DoubleSide}
        roughness={0.8}
      />
    </mesh>
  );
}
