// SPEC: _spec/chess-coach/multiplayer.puml
import { createEffect, createSignal, onCleanup } from "solid-js";

import { lastHumanMoveInfo } from "~/hooks/useMoveExecutor";
import { addMoveSan, currentFen, game, loadFen } from "~/store/gameStore";
import {
  OBSERVER_CAP,
  addObserver,
  addPlayer,
  applySnapshot,
  canStart,
  claimColor as claimColorMut,
  gameOver,
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
 * Wires a {@link PeerTransport} to the game + room stores. Mirrors the
 * decoupled coach pattern: `useMoveExecutor` emits `lastHumanMoveInfo` (and,
 * with `aiOpponent: false`, makes no AI call), and this hook reacts to relay
 * the move. The host is authoritative; guests/observers mirror its broadcasts.
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

  // Bind transport callbacks as soon as one exists.
  createEffect(() => {
    const t = transport();
    if (!t || t === bound) return;
    bound = t;
    t.onMessage((peerId, msg) => handleMessage(t, peerId, msg));
    t.onPeerStateChange((peerId, state) => handlePeerState(t, peerId, state));
  });

  // Relay the local player's own move (fires via lastHumanMoveInfo).
  createEffect(() => {
    const info = lastHumanMoveInfo();
    if (!info) return;
    const t = transport();
    if (!t) return;
    const fen = currentFen();
    if (fen === lastSyncedFen) return; // already relayed / applied
    lastSyncedFen = fen;
    if (t.role === "host") {
      const over = computeGameOver();
      if (over) setGameOver(over);
      t.broadcast({ t: "moveApplied", san: info.san, fen, gameOver: over });
    } else {
      t.broadcast({ t: "move", san: info.san });
    }
  });

  // Board orientation + input gate follow the player's chosen color.
  createEffect(() => {
    const c = myColor();
    if (c) setActivePlayerColor(c);
  });

  onCleanup(() => {
    bound?.close();
    bound = null;
  });

  function broadcastRoom(t: PeerTransport): void {
    t.broadcast({ t: "roomState", snapshot: snapshot(currentFen()) });
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
        if (currentFen() === msg.fen) return; // our own optimistic move — already applied
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

  function handlePeerState(t: PeerTransport, peerId: string, state: PeerState): void {
    if (t.role === "host") {
      if (state === "connected") setConnectionStatus("connected");
      if (state === "closed") {
        const wasPlayer = players().some((p) => p.peerId === peerId);
        removeMember(peerId);
        if (wasPlayer && started() && !gameOver()) {
          setGameOver({ result: "draw", message: "Opponent disconnected." });
        }
        broadcastRoom(t);
      }
    } else {
      if (state === "connected" && !helloSent) {
        const intent = joinIntent?.();
        if (intent) {
          helloSent = true;
          t.broadcast({ t: "hello", identity: intent.identity, desiredRole: intent.desiredRole });
        }
      }
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
