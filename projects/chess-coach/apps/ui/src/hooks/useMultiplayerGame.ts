// SPEC: _spec/chess-coach/multiplayer.puml
import { createEffect, createSignal, onCleanup } from "solid-js";

import { addMoveSan, currentFen, game, loadFen, setViewIndex } from "~/store/gameStore";
import {
  OBSERVER_CAP,
  addObserver,
  addPlayer,
  applySnapshot,
  canStart,
  claimColor as claimColorMut,
  gameOver,
  lastLocalMove,
  myColor,
  myPeerId,
  observers,
  players,
  removeMember,
  setConnectionStatus,
  setGameOver,
  setReady as setReadyMut,
  setSeat,
  setStarted,
  snapshot,
  started,
  swapColors,
} from "~/store/roomStore";
import { setActivePlayerColor } from "~/store/settingsStore";
import type {
  Color,
  GameOverInfo,
  Identity,
  PeerMessage,
  PeerState,
  PeerTransport,
  Seat,
} from "~/types/multiplayer";

/** What a guest announces to the host once its channel opens. */
export type JoinIntent = { identity: Identity; desiredRole: Seat };

const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

/** The host's own player id (peerId for guests is their WebRTC connId). */
export const HOST_SELF_ID = "host";

/** Derive a game-over verdict from the current position (no AI/coach involved). */
function computeGameOver(): GameOverInfo | null {
  const g = game();
  if (g.isCheckmate()) {
    const winner = g.turn() === "w" ? "black" : "white";
    return { result: winner, message: `Checkmate — ${winner} wins.` };
  }
  if (g.isStalemate()) return { result: "draw", message: "Draw — stalemate." };
  if (g.isThreefoldRepetition()) return { result: "draw", message: "Draw — threefold repetition." };
  if (g.isInsufficientMaterial()) {
    return { result: "draw", message: "Draw — insufficient material." };
  }
  if (g.isDraw()) return { result: "draw", message: "Draw." };
  return null;
}

export type MultiplayerActions = {
  claimColor: (color: Color) => void;
  swap: () => void;
  setReady: (ready: boolean) => void;
  resign: () => void;
};

/**
 * Wires a {@link PeerTransport} to the game + room stores. The LAN board
 * ({@link useMultiplayerBoard}) applies the local move and announces it via
 * `lastLocalMove`; this hook reacts to relay it to peers. No engine or coach is
 * involved. The host is authoritative; guests/observers mirror its broadcasts.
 *
 * @param transport accessor — null until the LanScreen has created one.
 * @param joinIntent accessor — a guest's identity/role, announced on connect.
 */
export function useMultiplayerGame(
  transport: () => PeerTransport | null,
  joinIntent?: () => JoinIntent | null,
): MultiplayerActions {
  let bound: PeerTransport | null = null;
  let lastSyncedFen = "";
  let helloSent = false;
  const [synced, setSynced] = createSignal(false);

  // A peer in the recoverable `disconnected` state is held for this long before
  // the game is declared over, giving a backgrounded phone a chance to come back.
  const RECONNECT_GRACE_MS = 15_000;
  const graceTimers = new Map<string, ReturnType<typeof setTimeout>>();
  const clearGrace = (peerId: string) => {
    const timer = graceTimers.get(peerId);
    if (timer) {
      clearTimeout(timer);
      graceTimers.delete(peerId);
    }
  };

  // Bind transport callbacks as soon as one exists.
  createEffect(() => {
    const t = transport();
    if (!t || t === bound) return;
    bound = t;
    t.onMessage((peerId, msg) => handleMessage(t, peerId, msg));
    t.onPeerStateChange((peerId, state) => handlePeerState(t, peerId, state));
  });

  // Relay the local player's own move. The multiplayer board announces it via
  // `lastLocalMove` (coach-free — no dependency on useMoveExecutor).
  createEffect(() => {
    const move = lastLocalMove();
    if (!move) return;
    const t = transport();
    if (!t) return;
    if (move.fen === lastSyncedFen) return; // already relayed / applied
    lastSyncedFen = move.fen;
    if (t.role === "host") {
      const over = computeGameOver();
      if (over) setGameOver(over);
      t.broadcast({ t: "moveApplied", san: move.san, fen: move.fen, gameOver: over });
    } else {
      t.broadcast({ t: "move", san: move.san });
    }
  });

  // Board orientation + input gate follow the player's chosen color.
  createEffect(() => {
    const c = myColor();
    if (c) setActivePlayerColor(c);
  });

  onCleanup(() => {
    for (const timer of graceTimers.values()) clearTimeout(timer);
    graceTimers.clear();
    bound?.close();
    bound = null;
  });

  function broadcastRoom(t: PeerTransport): void {
    // Snapshot the latest authoritative position (game().fen()), not currentFen()
    // — the host may be reviewing history, and a (re)joining peer must sync to
    // live, not to whatever ply the host happens to be viewing.
    t.broadcast({ t: "roomState", snapshot: snapshot(game().fen()) });
  }

  // Reset the history-view cursor to the latest ply. Called before applying a
  // relayed move so a player who stepped back through the move history doesn't
  // branch (and destroy) the shared game when the next move lands.
  function snapToLive(): void {
    setViewIndex(game().history().length);
  }

  function startIfReady(t: PeerTransport): void {
    if (started() || !canStart()) return;
    loadFen(START_FEN);
    lastSyncedFen = currentFen();
    setStarted(true);
    setSynced(true);
    broadcastRoom(t);
  }

  function handleMessage(t: PeerTransport, peerId: string, msg: PeerMessage): void {
    if (t.role === "host") handleHostMessage(t, peerId, msg);
    else handleGuestMessage(msg);
  }

  function handleHostMessage(t: PeerTransport, peerId: string, msg: PeerMessage): void {
    switch (msg.t) {
      case "hello": {
        if (msg.desiredRole === "player" && players().length < 2) addPlayer(peerId, msg.identity);
        else if (observers().length < OBSERVER_CAP) addObserver(peerId, msg.identity);
        else {
          t.send(peerId, { t: "roomFull" });
          return;
        }
        broadcastRoom(t);
        break;
      }
      case "claimColor":
        claimColorMut(peerId, msg.color);
        broadcastRoom(t);
        break;
      case "swapColor":
        swapColors();
        broadcastRoom(t);
        break;
      case "startRequest":
        setReadyMut(peerId, msg.ready);
        startIfReady(t);
        if (!started()) broadcastRoom(t);
        break;
      case "move": {
        snapToLive(); // a relayed move always appends to the latest position
        try {
          addMoveSan(msg.san);
        } catch {
          return; // illegal / out-of-turn — drop
        }
        const fen = currentFen();
        lastSyncedFen = fen;
        const over = computeGameOver();
        if (over) setGameOver(over);
        t.broadcast({ t: "moveApplied", san: msg.san, fen, gameOver: over });
        break;
      }
      case "resign": {
        const loser = players().find((p) => p.peerId === peerId)?.color;
        setGameOver(
          loser === "w"
            ? { result: "black", message: "White resigned." }
            : { result: "white", message: "Black resigned." },
        );
        broadcastRoom(t);
        break;
      }
    }
  }

  function handleGuestMessage(msg: PeerMessage): void {
    switch (msg.t) {
      case "roomState": {
        applySnapshot(msg.snapshot);
        const id = myPeerId();
        if (msg.snapshot.players.some((p) => p.peerId === id)) setSeat("player");
        else if (msg.snapshot.observers.some((o) => o.peerId === id)) setSeat("observer");
        // Sync the board to the authoritative position once the game starts
        // (or immediately for an observer who joined mid-game).
        if (msg.snapshot.started && !synced()) {
          loadFen(msg.snapshot.fen);
          lastSyncedFen = currentFen();
          setSynced(true);
        }
        break;
      }
      case "moveApplied": {
        if (msg.gameOver) setGameOver(msg.gameOver);
        // Compare the live position (not currentFen, which follows the history
        // view cursor) so our own optimistic move is deduped even while the
        // local player is reviewing an earlier position.
        if (game().fen() === msg.fen) return;
        snapToLive(); // append to the latest position, never a replayed one
        try {
          addMoveSan(msg.san);
        } catch {
          loadFen(msg.fen); // diverged — hard-resync to authoritative position
        }
        lastSyncedFen = currentFen();
        break;
      }
      case "roomFull":
        setConnectionStatus("disconnected");
        break;
    }
  }

  // Drop a peer for good: vacate its seat and, if it was a mid-game player, end
  // the game. Called on a terminal `closed` or when the reconnect grace expires.
  function dropPeer(t: PeerTransport, peerId: string): void {
    clearGrace(peerId);
    const wasPlayer = players().some((p) => p.peerId === peerId);
    removeMember(peerId);
    if (wasPlayer && started() && !gameOver()) {
      setGameOver({ result: "draw", message: "Opponent disconnected." });
      setConnectionStatus("disconnected");
    }
    broadcastRoom(t);
  }

  function handlePeerState(t: PeerTransport, peerId: string, state: PeerState): void {
    if (t.role === "host") {
      if (state === "connected") {
        clearGrace(peerId);
        setConnectionStatus("connected");
        // Resync a (re)connected peer to the authoritative position mid-game.
        if (started()) broadcastRoom(t);
      } else if (state === "disconnected") {
        // Recoverable: hold the seat through a grace window instead of ending
        // the game outright. A mid-game player drop shows "reconnecting"; if it
        // doesn't come back in time, the timer drops the peer for good.
        const isPlayer = players().some((p) => p.peerId === peerId);
        if (isPlayer && started() && !gameOver()) {
          setConnectionStatus("connecting");
          if (!graceTimers.has(peerId)) {
            graceTimers.set(
              peerId,
              setTimeout(() => dropPeer(t, peerId), RECONNECT_GRACE_MS),
            );
          }
        } else {
          // A lobby/observer drop has no seat to hold — release it immediately.
          dropPeer(t, peerId);
        }
      } else if (state === "closed") {
        dropPeer(t, peerId);
      }
    } else {
      if (state === "connected" && !helloSent) {
        const intent = joinIntent?.();
        if (intent) {
          helloSent = true;
          t.broadcast({ t: "hello", identity: intent.identity, desiredRole: intent.desiredRole });
        }
      }
      // Guests can't end the game (host is authoritative) — just reflect the
      // link state. `disconnected` reads as "reconnecting" while ICE retries.
      setConnectionStatus(
        state === "connected" ? "connected" : state === "closed" ? "disconnected" : "connecting",
      );
    }
  }

  return {
    claimColor(color: Color): void {
      const t = transport();
      if (!t) return;
      if (t.role === "host") {
        claimColorMut(HOST_SELF_ID, color);
        broadcastRoom(t);
      } else {
        t.broadcast({ t: "claimColor", color });
      }
    },
    swap(): void {
      const t = transport();
      if (!t) return;
      if (t.role === "host") {
        swapColors();
        broadcastRoom(t);
      } else {
        t.broadcast({ t: "swapColor" });
      }
    },
    setReady(ready: boolean): void {
      const t = transport();
      if (!t) return;
      if (t.role === "host") {
        setReadyMut(HOST_SELF_ID, ready);
        startIfReady(t);
        if (!started()) broadcastRoom(t);
      } else {
        t.broadcast({ t: "startRequest", ready });
      }
    },
    resign(): void {
      const t = transport();
      if (!t) return;
      if (t.role === "host") {
        const c = myColor();
        setGameOver(
          c === "w"
            ? { result: "black", message: "White resigned." }
            : { result: "white", message: "Black resigned." },
        );
        broadcastRoom(t);
      } else {
        t.broadcast({ t: "resign" });
      }
    },
  };
}
