// SPEC: _spec/chess-coach/multiplayer.puml
import type { TailnetProbeResult } from "~/types/multiplayer";

/**
 * Best-effort Tailscale-connectivity probe for the LanScreen onboarding.
 *
 * A browser can't query the OS for Tailscale status, but it CAN gather its own
 * WebRTC ICE host candidates. Tailscale assigns each device an address in the
 * CGNAT range 100.64.0.0/10 (100.64.0.0 – 100.127.255.255). If one of our host
 * candidates falls in that range, this device has an up tailnet interface — the
 * same candidate the multiplayer transport relies on (see services/peer.ts).
 *
 * This is a heuristic, not a guarantee: some browsers replace host candidates
 * with mDNS `*.local` names (hiding the IP), so a "not-detected" result is
 * inconclusive. The LanScreen always offers a manual "I'm connected" override.
 */
const PROBE_TIMEOUT_MS = 2500;

/** True if `ip` is an IPv4 address inside Tailscale's CGNAT range 100.64.0.0/10. */
export function isTailscaleAddress(ip: string): boolean {
  const m = /^(\d{1,3})\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/.exec(ip);
  if (!m) return false;
  const a = Number(m[1]);
  const b = Number(m[2]);
  return a === 100 && b >= 64 && b <= 127;
}

/** Pull the candidate IP from an RTCIceCandidate (prefer `.address`, else parse the SDP line). */
function candidateAddress(c: RTCIceCandidate): string | null {
  if (c.address) return c.address;
  // "candidate:... <component> <proto> <prio> <ADDRESS> <port> typ host ..."
  const parts = c.candidate.split(" ");
  return parts.length > 4 ? parts[4] : null;
}

/**
 * Gather local ICE candidates and resolve as soon as a Tailscale 100.x host
 * candidate appears (or after gathering completes / a short timeout otherwise).
 */
export function probeTailnet(timeoutMs = PROBE_TIMEOUT_MS): Promise<TailnetProbeResult> {
  if (typeof RTCPeerConnection === "undefined") {
    return Promise.resolve({ status: "not-detected" });
  }

  const pc = new RTCPeerConnection({ iceServers: [] });
  return new Promise<TailnetProbeResult>((resolve) => {
    let done = false;
    const finish = (result: TailnetProbeResult) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      try {
        pc.close();
      } catch {
        /* already closed */
      }
      resolve(result);
    };

    const timer = setTimeout(() => finish({ status: "not-detected" }), timeoutMs);

    pc.onicecandidate = (e) => {
      if (!e.candidate) {
        // Null candidate => gathering complete with no tailnet match.
        finish({ status: "not-detected" });
        return;
      }
      const addr = candidateAddress(e.candidate);
      if (addr && isTailscaleAddress(addr)) finish({ status: "connected", address: addr });
    };

    pc.createDataChannel("probe");
    pc.createOffer()
      .then((offer) => pc.setLocalDescription(offer))
      .catch(() => finish({ status: "not-detected" }));
  });
}
