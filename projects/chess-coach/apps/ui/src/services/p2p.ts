// Bridge to the embedded Go thin-server on Android (apps/android). In the
// Android WebView the shell injects `window.ChessNative` (MoveBridge.kt) and
// pushes peer events to `window.__chessNative`. Everywhere else this is inert
// (`isP2PAvailable()` is false). See _spec/distribution.md §3 + webrtc-p2p.puml.

export type P2PMove = { san: string; uci: string; fenAfter: string; seq?: number };

export type PeerState = "open" | "closed" | "resigned";

/** Native session snapshot, for resume after a WebView reload. */
export type P2PSnapshot = {
  gameId: string;
  startingFen: string;
  moves: P2PMove[];
  myColor: "w" | "b";
  peerOpen: boolean;
};

/** Injected by the Android shell (`@JavascriptInterface` named `ChessNative`). */
interface ChessNativeBridge {
  hostGame(): string; // returns the dial string to share with the opponent
  joinGame(dial: string): void;
  sendMove(json: string): void;
  resign(): void;
  snapshot(): string; // JSON-encoded P2PSnapshot
}

declare global {
  interface Window {
    ChessNative?: ChessNativeBridge;
    // Go → JS push target; the shell calls these on inbound peer events.
    __chessNative?: {
      onPeerMove(move: P2PMove): void;
      onPeerState(state: PeerState): void;
    };
  }
}

export function isP2PAvailable(): boolean {
  return typeof window !== "undefined" && !!window.ChessNative;
}

type Handlers = {
  onPeerMove?: (move: P2PMove) => void;
  onPeerState?: (state: PeerState) => void;
};

/**
 * Thin, store-agnostic wrapper over the native bridge. The caller wires
 * `onPeerMove` to the game store (e.g. `addMoveSan(move.san)`) and disables the
 * local AI reply (`capabilities().aiOpponent === false`) while a P2P game is active.
 */
export class P2PClient {
  private handlers: Handlers = {};

  constructor() {
    if (typeof window !== "undefined") {
      window.__chessNative = {
        onPeerMove: (move) => this.handlers.onPeerMove?.(move),
        onPeerState: (state) => this.handlers.onPeerState?.(state),
      };
    }
  }

  get available(): boolean {
    return isP2PAvailable();
  }

  on(handlers: Handlers): void {
    this.handlers = { ...this.handlers, ...handlers };
  }

  hostGame(): string {
    return this.bridge().hostGame();
  }

  joinGame(dial: string): void {
    this.bridge().joinGame(dial);
  }

  sendMove(move: P2PMove): void {
    this.bridge().sendMove(JSON.stringify(move));
  }

  resign(): void {
    this.bridge().resign();
  }

  snapshot(): P2PSnapshot | null {
    try {
      return JSON.parse(this.bridge().snapshot()) as P2PSnapshot;
    } catch {
      return null;
    }
  }

  private bridge(): ChessNativeBridge {
    const b = typeof window !== "undefined" ? window.ChessNative : undefined;
    if (!b) throw new Error("P2P bridge unavailable (not running in the Android shell)");
    return b;
  }
}
