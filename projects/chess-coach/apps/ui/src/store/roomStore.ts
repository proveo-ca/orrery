// SPEC: _spec/chess-coach/multiplayer.puml
import { createSignal } from "solid-js";

import type {
  Color,
  GameOverInfo,
  Identity,
  MemberInfo,
  PlayerInfo,
  Role,
  RoomSnapshot,
  Seat,
} from "~/types/multiplayer";

export type ConnStatus =
  | "idle"
  | "offering"
  | "awaitingAnswer"
  | "connecting"
  | "connected"
  | "disconnected";

/** Max spectators per room (the two players are separate). */
export const OBSERVER_CAP = 4;

const [role, setRole] = createSignal<Role | null>(null);
const [seat, setSeat] = createSignal<Seat | null>(null);
const [myPeerId, setMyPeerId] = createSignal<string | null>(null);
const [connectionStatus, setConnectionStatus] = createSignal<ConnStatus>("idle");
const [players, setPlayers] = createSignal<PlayerInfo[]>([]);
const [observers, setObservers] = createSignal<MemberInfo[]>([]);
const [started, setStarted] = createSignal(false);
const [gameOver, setGameOver] = createSignal<GameOverInfo | null>(null);

export {
  role,
  seat,
  myPeerId,
  connectionStatus,
  players,
  observers,
  started,
  gameOver,
  setRole,
  setSeat,
  setMyPeerId,
  setConnectionStatus,
  setStarted,
  setGameOver,
};

/** The local participant's chosen color, derived from the players list. */
export const myColor = (): Color | null =>
  players().find((p) => p.peerId === myPeerId())?.color ?? null;

/** Seat lookup helpers. */
export const playerByColor = (c: Color): PlayerInfo | undefined =>
  players().find((p) => p.color === c);

/** True when the game is ready to start: 2 players, distinct colors, both ready. */
export const canStart = (): boolean => {
  const ps = players();
  return (
    ps.length === 2 &&
    ps.every((p) => p.ready) &&
    ps[0].color != null &&
    ps[1].color != null &&
    ps[0].color !== ps[1].color
  );
};

// ── Host-authoritative mutations ─────────────────────────────────────────
// Only the host calls these; guests mirror via applySnapshot().

export const addPlayer = (peerId: string, identity: Identity): void => {
  setPlayers((ps) => [...ps, { peerId, identity, color: null, ready: false }]);
};

export const addObserver = (peerId: string, identity: Identity): void => {
  setObservers((os) => [...os, { peerId, identity }]);
};

export const removeMember = (peerId: string): void => {
  setPlayers((ps) => ps.filter((p) => p.peerId !== peerId));
  setObservers((os) => os.filter((o) => o.peerId !== peerId));
};

/** Seat `peerId` to `color` if free; vacating any color they already held.
 *  Any color change clears both ready votes (colors lock only at Start). */
export const claimColor = (peerId: string, color: Color): void => {
  if (playerByColor(color)) return; // taken — selecting an occupied seat is a swap, not a claim
  setPlayers((ps) =>
    ps.map((p) => (p.peerId === peerId ? { ...p, color, ready: false } : { ...p, ready: false })),
  );
};

/** Exchange the two players' colors. Clears both ready votes. */
export const swapColors = (): void => {
  setPlayers((ps) =>
    ps.length === 2
      ? ps.map((p, _i, arr) => ({
          ...p,
          color: arr.find((o) => o.peerId !== p.peerId)?.color ?? p.color,
          ready: false,
        }))
      : ps,
  );
};

export const setReady = (peerId: string, ready: boolean): void => {
  setPlayers((ps) => ps.map((p) => (p.peerId === peerId ? { ...p, ready } : p)));
};

// ── Snapshot (host broadcasts, guests apply) ──────────────────────────────

export const snapshot = (fen: string): RoomSnapshot => ({
  players: players(),
  observers: observers(),
  started: started(),
  gameOver: gameOver(),
  fen,
});

export const applySnapshot = (s: RoomSnapshot): void => {
  setPlayers(s.players);
  setObservers(s.observers);
  setStarted(s.started);
  setGameOver(s.gameOver);
};

export const reset = (): void => {
  setRole(null);
  setSeat(null);
  setMyPeerId(null);
  setConnectionStatus("idle");
  setPlayers([]);
  setObservers([]);
  setStarted(false);
  setGameOver(null);
};
