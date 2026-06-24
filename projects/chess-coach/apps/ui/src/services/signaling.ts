// SPEC: _spec/chess-coach/multiplayer.puml
import type { SignalKind, SignalPayload } from "~/types/multiplayer";

/**
 * Serverless WebRTC signaling codec.
 *
 * With no signaling server, the SDP offer/answer is exchanged out-of-band:
 * the host renders a shareable link (and the joiner returns one), each
 * carrying a base64url-encoded payload in the URL hash. Non-trickle ICE
 * (see services/peer.ts) means the whole SDP — including the single
 * Tailscale host candidate — is contained in one payload.
 *
 * `connId` ties an answer back to the specific pending offer the host minted
 * for that joiner (the host runs N connections, one per peer).
 */
/** Deep-link path (under the app base) that the LanScreen handles. */
export const SIGNAL_ROUTE = "/chess/lan";

export function encodeSignal(payload: SignalPayload): string {
  const json = JSON.stringify(payload);
  const bytes = new TextEncoder().encode(json);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decodeSignal(encoded: string): SignalPayload {
  const b64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  const parsed = JSON.parse(new TextDecoder().decode(bytes));
  if (typeof parsed?.connId !== "string" || typeof parsed?.sdp !== "string") {
    throw new Error("Invalid signaling payload");
  }
  return { connId: parsed.connId, sdp: parsed.sdp };
}

/** Build a shareable link carrying an offer (`o`) or answer (`a`). */
export function buildSignalLink(kind: SignalKind, payload: SignalPayload, origin?: string): string {
  const base = origin ?? window.location.origin;
  return `${base}${SIGNAL_ROUTE}#${kind}=${encodeSignal(payload)}`;
}

/** Parse the URL hash; returns null when it isn't a signaling payload. */
export function parseSignalHash(
  hash?: string,
): { kind: SignalKind; payload: SignalPayload } | null {
  const h = hash ?? window.location.hash;
  const m = /^#(o|a)=(.+)$/.exec(h);
  if (!m) return null;
  try {
    return { kind: m[1] as SignalKind, payload: decodeSignal(m[2]) };
  } catch {
    return null;
  }
}
