// SPEC: _spec/chess-coach/multiplayer.puml
import type { PieceSet } from "~/types/settings";

/** Chess colors, matching chess.js. */
export type Color = "w" | "b";

/** A room participant is either one of the two players or a spectator. */
export type Seat = "player" | "observer";

/** Topology role: the room creator hosts (relays); everyone else is a guest. */
export type Role = "host" | "guest";

/** Lifecycle of the local participant's peer connection (roomStore signal). */
export type ConnStatus =
  | "idle"
  | "offering"
  | "awaitingAnswer"
  | "connecting"
  | "connected"
  | "disconnected";

export type Identity = { name: string; pieceSet?: PieceSet };

/** A seated player. `color` is null until claimed in the lobby. */
export type PlayerInfo = {
  peerId: string;
  identity: Identity;
  color: Color | null;
  ready: boolean;
};

export type MemberInfo = { peerId: string; identity: Identity };

export type GameOverInfo = {
  result: "white" | "black" | "draw";
  message: string;
};

/**
 * Host-authoritative room state broadcast to every peer. Guests/observers
 * mirror this verbatim; they never mutate room membership locally.
 */
export type RoomSnapshot = {
  players: PlayerInfo[];
  observers: MemberInfo[];
  started: boolean;
  gameOver: GameOverInfo | null;
  /** Current authoritative FEN, so a peer can sync the board on join/start. */
  fen: string;
};

/**
 * Messages exchanged over the WebRTC DataChannel (JSON). The host is the
 * authority: guests send intents (hello/claimColor/move/...) and the host
 * echoes authoritative `roomState` / `moveApplied` back to all peers.
 */
export type PeerMessage =
  | { t: "hello"; identity: Identity; desiredRole: Seat }
  | { t: "claimColor"; color: Color }
  | { t: "swapColor" }
  | { t: "roomState"; snapshot: RoomSnapshot }
  | { t: "move"; san: string }
  | { t: "moveApplied"; san: string; fen: string; gameOver: GameOverInfo | null }
  | { t: "startRequest"; ready: boolean }
  | { t: "resign" }
  | { t: "roomFull" }
  | { t: "bye"; peerId: string };

// ── Transport (implemented in services/peer.ts) ──────────────────────────

export type PeerState = "connecting" | "connected" | "closed";

/**
 * Vendor-agnostic peer transport (mirrors the CoachService seam). The game
 * layer talks to this interface; WebRTC is one implementation. Host-hub: the
 * host runs N connections and `broadcast`s; a guest holds one link to the host.
 */
export interface PeerTransport {
  readonly role: Role;
  onMessage(cb: (peerId: string, msg: PeerMessage) => void): void;
  onPeerStateChange(cb: (peerId: string, state: PeerState) => void): void;
  /** Send to a specific peer (host) — guests ignore peerId and reach the host. */
  send(peerId: string, msg: PeerMessage): void;
  /** Send to every connected peer (host) — a guest sends only to the host. */
  broadcast(msg: PeerMessage): void;
  close(): void;
}

// ── Signaling payloads (encoded by services/signaling.ts) ─────────────────

export type SignalKind = "o" | "a";
export type SignalPayload = { connId: string; sdp: string };

// ── LAN onboarding (services/platform.ts, services/tailscale.ts) ──────────

/** Detected client OS, used to tailor Tailscale install instructions. */
export type OS = "linux" | "macos" | "windows" | "ios" | "android" | "unknown";

export interface PlatformInfo {
  os: OS;
  /** Phone/tablet — drives "open the app / get it from the store" wording. */
  isMobile: boolean;
  /** Human label, e.g. "macOS", "Android". */
  label: string;
  /** Tailscale per-platform download landing page (redirects to store on mobile). */
  downloadUrl: string;
  /** Tailscale install/setup documentation for this platform. */
  installDocsUrl: string;
}

/** Result of the best-effort tailnet connectivity probe. */
export type TailnetStatus = "checking" | "connected" | "not-detected";

export interface TailnetProbeResult {
  status: Exclude<TailnetStatus, "checking">;
  /** The matched 100.x address, when detected. */
  address?: string;
}
