import { useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { useStore } from './store';

// Game-time ticker. Runs inside the Canvas so it has access to useFrame, but
// is otherwise a side-effect component — returns null. Per-entity ticking
// (player, cats) lives in those components' own useFrames.
export function GameLoop() {
  useFrame((_, delta) => {
    useStore.getState().tickGameTime(delta);
  });

  useEffect(() => {
    const unsub = useStore.subscribe(
      (s) => s.phase,
      (phase) => {
        if (phase === 'GAME_OVER') {
          console.log('%c[Nightfall] DAWN REVEAL — All curtains open! The cats are just cats.', 'color:#ffcc00');
        }
      },
    );
    return unsub;
  }, []);

  return null;
}
