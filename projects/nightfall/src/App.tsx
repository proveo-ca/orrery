import { Canvas } from '@react-three/fiber';
import { Scene } from './Scene';
import { HUD } from './HUD';

export function App() {
  return (
    <>
      <Canvas
        shadows
        camera={{ fov: 75, near: 0.1, far: 100, position: [0, 1.6, 0] }}
        style={{ position: 'fixed', inset: 0 }}
        onCreated={({ camera }) => camera.lookAt(9, 0.5, -7)}
      >
        <Scene />
      </Canvas>
      <HUD />
      <div
        id="instructions"
        style={{
          position: 'fixed',
          bottom: 20,
          left: '50%',
          transform: 'translateX(-50%)',
          color: '#888',
          font: '14px monospace',
          pointerEvents: 'none',
        }}
      >
        Click to lock pointer · WASD to move · Shift to sprint
      </div>
    </>
  );
}
