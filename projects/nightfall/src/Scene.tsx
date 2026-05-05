import { useStore } from './store';
import { House } from './environment/House';
import { Curtain } from './environment/Curtain';
import { Cat } from './cats/Cat';
import { Player } from './core/Player';
import { GameLoop } from './GameLoop';

export function Scene() {
  return (
    <>
      <fog attach="fog" args={[0x0a0a12, 2, 22]} />
      <ambientLight color={0x111122} intensity={0.12} />
      <directionalLight color={0x445577} intensity={0.25} position={[8, 12, 6]} />
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[30, 30]} />
        <meshStandardMaterial color={0x1a1a1a} roughness={0.95} />
      </mesh>
      <GameLoop />
      <House />
      <Player />
      <Cats />
      <Curtain position={[-6, 1.7, -11.6]} id={0} />
      <Curtain position={[ 6, 1.7, -11.6]} id={1} />
      <Curtain position={[-6, 1.7,  11.6]} id={2} />
      <Curtain position={[ 6, 1.7,  11.6]} id={3} />
    </>
  );
}

// Spawns one cat at the first spawn point, matching the original main.ts which
// sliced spawnPoints to [0,1]. Spawn points are populated by House on mount, so
// the first render returns null until the store updates.
function Cats() {
  const spawnPoints = useStore((s) => s.spawnPoints);
  if (spawnPoints.length === 0) return null;
  return <Cat id="cat0" spawn={spawnPoints[0]} />;
}
