import type * as THREE from 'three';
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

export type Phase = 'PLAYING' | 'GAME_OVER';

// Cat lifecycle as a discriminated union. Each variant carries exactly the
// data that variant needs (e.g. HESITATING owns its countdown), so leaving a
// state automatically discards its bookkeeping — no manual `flag = -1` resets.
export type CatPhase =
  | { kind: 'STALKING'; lookedAtTime: number }
  | { kind: 'HESITATING'; remaining: number }
  | { kind: 'HESITATING_LOST'; remaining: number }
  | { kind: 'HIDING' }
  | { kind: 'FLEEING'; remaining: number }
  | { kind: 'SEEKING_LOS' };

export type CatState = {
  id: string;
  group: THREE.Group | null;
  phase: CatPhase;
};

export const TOTAL_CURTAINS = 4;
export const GAME_DURATION_S = 20 * 60;
export const BPM_MIN = 60;
export const BPM_MAX = 180;
export const BPM_DEFAULT = 75;

type Store = {
  phase: Phase;
  gameTime: number;
  curtainsOpened: number;
  bpm: number;
  cats: Record<string, CatState>;
  houseColliders: THREE.Box3[];
  spawnPoints: THREE.Vector3[];

  tickGameTime: (delta: number) => void;
  openCurtain: () => void;
  setBpm: (n: number) => void;
  bumpBpm: (delta: number) => void;
  setHouseColliders: (colliders: THREE.Box3[]) => void;
  setSpawnPoints: (points: THREE.Vector3[]) => void;
  registerCat: (cat: CatState) => void;
  setCatPhase: (id: string, next: CatPhase) => void;
};

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

export const useStore = create<Store>()(
  subscribeWithSelector((set) => ({
    phase: 'PLAYING',
    gameTime: 0,
    curtainsOpened: 0,
    bpm: BPM_DEFAULT,
    cats: {},
    houseColliders: [],
    spawnPoints: [],

    tickGameTime: (delta) =>
      set((s) => {
        if (s.phase === 'GAME_OVER') return s;
        const gameTime = s.gameTime + delta;
        return gameTime >= GAME_DURATION_S
          ? { gameTime, phase: 'GAME_OVER' as const }
          : { gameTime };
      }),

    openCurtain: () =>
      set((s) => {
        if (s.phase === 'GAME_OVER') return s;
        const curtainsOpened = s.curtainsOpened + 1;
        return curtainsOpened >= TOTAL_CURTAINS
          ? { curtainsOpened, phase: 'GAME_OVER' as const }
          : { curtainsOpened };
      }),

    setBpm: (n) => set({ bpm: clamp(n, BPM_MIN, BPM_MAX) }),
    bumpBpm: (delta) => set((s) => ({ bpm: clamp(s.bpm + delta, BPM_MIN, BPM_MAX) })),

    setHouseColliders: (houseColliders) => set({ houseColliders }),
    setSpawnPoints: (spawnPoints) => set({ spawnPoints }),

    registerCat: (cat) => set((s) => ({ cats: { ...s.cats, [cat.id]: cat } })),

    setCatPhase: (id, phase) =>
      set((s) => {
        const cat = s.cats[id];
        if (!cat) return s;
        return { cats: { ...s.cats, [id]: { ...cat, phase } } };
      }),
  })),
);
