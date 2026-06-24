// SPEC: _spec/chess-coach/multiplayer.puml
import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from "lz-string";

import type { SignalKind, SignalPayload } from "~/types/multiplayer";

/**
 * Serverless WebRTC signaling codec.
 *
 * With no signaling server, the SDP offer/answer is exchanged out-of-band:
 * the host renders a shareable link (and the joiner returns one), each
 * carrying the payload in the URL hash. Non-trickle ICE (see services/peer.ts)
 * means the whole SDP — including the single Tailscale host candidate — is
 * contained in one payload.
 *
 * A data-channel SDP is ~600 bytes, but it's almost all fixed boilerplate
 * (v=/o=/m=/sctp-port/…). The session-specific bits are just the ICE creds,
 * the DTLS fingerprint, the setup role, and the candidate line(s). So we
 * **minify**: extract those fields, drop everything else, and rebuild a
 * canonical SDP on the far side (browsers interoperate — a standard remote
 * description is accepted by Chromium / WebKit / Firefox alike). That ~halves
 * the payload before the lz-string pass below. Anything that doesn't match the
 * expected shape falls back to shipping the raw SDP, so an unfamiliar SDP can
 * never break the handshake. The exchange is live and same-version on both
 * ends — no stored-link / wire-format migration concern.
 *
 * On top, lz-string (the same codec as the PGN share) compresses the JSON;
 * plain base64 would *inflate* it ~33%. Output is URL-safe (no escaping).
 *
 * `connId` ties an answer back to the specific pending offer the host minted
 * for that joiner (the host runs N connections, one per peer).
 */
/** Deep-link path (under the app base) that the LanScreen handles. */
export const SIGNAL_ROUTE = "/chess/lan";

/** The fixed boilerplate of a data-channel-only SDP, rebuilt on decode. */
const SDP_HEAD = [
  "v=0",
  "o=- 0 0 IN IP4 127.0.0.1",
  "s=-",
  "t=0 0",
  "a=group:BUNDLE 0",
  "a=extmap-allow-mixed",
  "a=msid-semantic: WMS",
  "m=application 9 UDP/DTLS/SCTP webrtc-datachannel",
  "c=IN IP4 0.0.0.0",
];

/** The session-specific fields lifted out of (and rebuilt into) an SDP. */
type MiniSdp = {
  u: string; // ice-ufrag
  w: string; // ice-pwd
  f: string[]; // fingerprint value(s): "<algo> <hex>"
  s: string; // setup role: actpass | active | passive
  c: string[]; // candidate line(s): text after "a=candidate:"
};

const firstGroup = (sdp: string, re: RegExp): string | undefined =>
  sdp.match(re)?.[1]?.trim();
const allGroups = (sdp: string, re: RegExp): string[] =>
  [...sdp.matchAll(re)].map((m) => m[1].trim());

/** Lift the variable fields from a data-channel SDP, or null if it's not one. */
function minifySdp(sdp: string): MiniSdp | null {
  const u = firstGroup(sdp, /^a=ice-ufrag:(.+)$/m);
  const w = firstGroup(sdp, /^a=ice-pwd:(.+)$/m);
  const s = firstGroup(sdp, /^a=setup:(.+)$/m);
  const f = allGroups(sdp, /^a=fingerprint:(.+)$/gm);
  const c = allGroups(sdp, /^a=candidate:(.+)$/gm);
  // ufrag/pwd/fingerprint/setup are mandatory for a usable description; without
  // any of them, don't risk a lossy rebuild — ship the raw SDP instead.
  if (!u || !w || !s || f.length === 0) return null;
  return { u, w, f, s, c };
}

/** Rebuild a canonical, broadly-accepted SDP from the lifted fields. */
function rebuildSdp(m: MiniSdp): string {
  const lines = [...SDP_HEAD];
  for (const cand of m.c) lines.push(`a=candidate:${cand}`);
  lines.push(`a=ice-ufrag:${m.u}`, `a=ice-pwd:${m.w}`, "a=ice-options:trickle");
  for (const fp of m.f) lines.push(`a=fingerprint:${fp}`);
  lines.push(`a=setup:${m.s}`, "a=mid:0", "a=sctp-port:5000", "a=max-message-size:262144");
  return `${lines.join("\r\n")}\r\n`;
}

export function encodeSignal(payload: SignalPayload): string {
  const mini = minifySdp(payload.sdp);
  const wire = mini ? { i: payload.connId, ...mini } : { i: payload.connId, r: payload.sdp };
  // lz-string's URI-safe alphabet still emits '+', which some transports turn
  // into a space (corrupting a copy-pasted link). Map it to '.' — unreserved in
  // URLs and outside lz-string's alphabet, so the reverse is unambiguous.
  return compressToEncodedURIComponent(JSON.stringify(wire)).replace(/\+/g, ".");
}

export function decodeSignal(encoded: string): SignalPayload {
  const json = decompressFromEncodedURIComponent(encoded.replace(/\./g, "+"));
  if (!json) throw new Error("Invalid signaling payload");
  const o = JSON.parse(json);
  if (typeof o?.i !== "string") throw new Error("Invalid signaling payload");

  // Raw fallback (older shape's `r`), else rebuild from the minified fields.
  let sdp: string;
  if (typeof o.r === "string") {
    sdp = o.r;
  } else if (
    typeof o.u === "string" &&
    typeof o.w === "string" &&
    typeof o.s === "string" &&
    Array.isArray(o.f) &&
    Array.isArray(o.c)
  ) {
    sdp = rebuildSdp(o as MiniSdp);
  } else {
    throw new Error("Invalid signaling payload");
  }
  return { connId: o.i, sdp };
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
