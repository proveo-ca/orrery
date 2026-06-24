// SPEC: _spec/chess-coach/multiplayer.puml
import type { PeerMessage, PeerState, PeerTransport, SignalPayload } from "~/types/multiplayer";

/**
 * WebRTC implementations of {@link PeerTransport}. Host-hub topology: the host
 * runs N connections (one per peer) and `broadcast`s to all; a guest holds a
 * single link to the host. Because every peer is on the same Tailscale tailnet,
 * ICE needs no STUN/TURN — the 100.x host candidate is directly reachable
 * (`iceServers: []`). Gathering is non-trickle so a complete offer/answer fits
 * one shareable link.
 */
const RTC_CONFIG: RTCConfiguration = { iceServers: [] };
const ICE_GATHER_TIMEOUT_MS = 3000;
const DATACHANNEL_LABEL = "chess";

/** Resolve once ICE gathering completes (non-trickle), with a safety timeout. */
function waitIceComplete(pc: RTCPeerConnection): Promise<void> {
  if (pc.iceGatheringState === "complete") return Promise.resolve();
  return new Promise((resolve) => {
    const finish = () => {
      pc.removeEventListener("icegatheringstatechange", onChange);
      clearTimeout(timer);
      resolve();
    };
    const onChange = () => {
      if (pc.iceGatheringState === "complete") finish();
    };
    const timer = setTimeout(finish, ICE_GATHER_TIMEOUT_MS);
    pc.addEventListener("icegatheringstatechange", onChange);
  });
}

let _idSeq = 0;
function nextConnId(): string {
  _idSeq += 1;
  return `c${_idSeq}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Map the raw RTCPeerConnection state to our coarser PeerState. Crucially
 * `disconnected`/`failed` are RECOVERABLE (reported as "disconnected") — ICE can
 * re-validate the same path (Tailscale's 100.x address survives Wi-Fi↔cellular
 * handoffs), so the game layer holds the seat instead of ending the game. Only
 * an explicit `closed` is terminal. `new`/`connecting` carry no signal.
 */
function mapConnState(s: RTCPeerConnectionState): PeerState | null {
  switch (s) {
    case "connected":
      return "connected";
    case "disconnected":
    case "failed":
      return "disconnected";
    case "closed":
      return "closed";
    default:
      return null;
  }
}

/** Host side: one RTCPeerConnection + DataChannel per joiner, keyed by connId. */
export class HostHubTransport implements PeerTransport {
  readonly role = "host" as const;
  private peers = new Map<string, { pc: RTCPeerConnection; dc: RTCDataChannel }>();
  private pending = new Map<string, RTCPeerConnection>();
  private msgCb: ((peerId: string, msg: PeerMessage) => void) | undefined;
  private stateCb: ((peerId: string, state: PeerState) => void) | undefined;

  onMessage(cb: (peerId: string, msg: PeerMessage) => void): void {
    this.msgCb = cb;
  }
  onPeerStateChange(cb: (peerId: string, state: PeerState) => void): void {
    this.stateCb = cb;
  }

  /** Mint a fresh offer for a new joiner; share the returned payload as a link/QR. */
  async createOffer(): Promise<SignalPayload> {
    const connId = nextConnId();
    const pc = new RTCPeerConnection(RTC_CONFIG);
    const dc = pc.createDataChannel(DATACHANNEL_LABEL);
    this.wire(connId, pc, dc);
    await pc.setLocalDescription(await pc.createOffer());
    await waitIceComplete(pc);
    this.pending.set(connId, pc);
    return { connId, sdp: pc.localDescription?.sdp ?? "" };
  }

  /** Complete the handshake with the joiner's returned answer. */
  async acceptAnswer(answer: SignalPayload): Promise<void> {
    const pc = this.pending.get(answer.connId);
    if (!pc) throw new Error(`No pending offer for ${answer.connId}`);
    this.pending.delete(answer.connId);
    await pc.setRemoteDescription({ type: "answer", sdp: answer.sdp });
  }

  send(peerId: string, msg: PeerMessage): void {
    const peer = this.peers.get(peerId);
    if (peer && peer.dc.readyState === "open") peer.dc.send(JSON.stringify(msg));
  }

  broadcast(msg: PeerMessage): void {
    const data = JSON.stringify(msg);
    for (const { dc } of this.peers.values()) {
      if (dc.readyState === "open") dc.send(data);
    }
  }

  restartIce(): void {
    for (const { pc } of this.peers.values()) pc.restartIce?.();
  }

  close(): void {
    for (const { pc } of this.peers.values()) pc.close();
    for (const pc of this.pending.values()) pc.close();
    this.peers.clear();
    this.pending.clear();
  }

  private wire(connId: string, pc: RTCPeerConnection, dc: RTCDataChannel): void {
    dc.onopen = () => {
      this.peers.set(connId, { pc, dc });
      this.stateCb?.(connId, "connected");
    };
    dc.onclose = () => {
      this.peers.delete(connId);
      this.stateCb?.(connId, "closed");
    };
    dc.onmessage = (e) => {
      try {
        this.msgCb?.(connId, JSON.parse(e.data as string) as PeerMessage);
      } catch {
        /* ignore malformed frame */
      }
    };
    pc.onconnectionstatechange = () => {
      const state = mapConnState(pc.connectionState);
      if (!state) return;
      if (state === "closed") {
        // Keep recoverable peers in the map (dc stays "open"; outbound frames
        // buffer and flush on recovery). Only drop on terminal close.
        this.peers.delete(connId);
        this.stateCb?.(connId, "closed");
      } else if (state === "disconnected") {
        pc.restartIce?.();
        this.stateCb?.(connId, "disconnected");
      } else if (dc.readyState === "open") {
        // "connected" is only actionable once the channel can carry data. On
        // initial connect dc.onopen fires it; this branch covers RECOVERY,
        // where pc returns to connected while the dc was never closed.
        this.stateCb?.(connId, "connected");
      }
    };
  }
}

/** Guest side: a single link to the host. */
export class GuestLinkTransport implements PeerTransport {
  static readonly HOST_ID = "host";
  readonly role = "guest" as const;
  private pc: RTCPeerConnection | undefined;
  private dc: RTCDataChannel | undefined;
  private msgCb: ((peerId: string, msg: PeerMessage) => void) | undefined;
  private stateCb: ((peerId: string, state: PeerState) => void) | undefined;

  onMessage(cb: (peerId: string, msg: PeerMessage) => void): void {
    this.msgCb = cb;
  }
  onPeerStateChange(cb: (peerId: string, state: PeerState) => void): void {
    this.stateCb = cb;
  }

  /** Consume the host's offer and produce the answer to return out-of-band. */
  async createAnswer(offer: SignalPayload): Promise<SignalPayload> {
    const pc = new RTCPeerConnection(RTC_CONFIG);
    this.pc = pc;
    pc.ondatachannel = (e) => this.wire(e.channel);
    pc.onconnectionstatechange = () => {
      const state = mapConnState(pc.connectionState);
      if (!state) return;
      if (state === "closed") {
        this.stateCb?.(GuestLinkTransport.HOST_ID, "closed");
      } else if (state === "disconnected") {
        pc.restartIce?.();
        this.stateCb?.(GuestLinkTransport.HOST_ID, "disconnected");
      } else if (this.dc?.readyState === "open") {
        // Only after the channel is open (initial connect → dc.onopen; this
        // branch is RECOVERY). Emitting on bare pc-connected would fire before
        // the dc opens and the guest's hello would be dropped → no seat.
        this.stateCb?.(GuestLinkTransport.HOST_ID, "connected");
      }
    };
    await pc.setRemoteDescription({ type: "offer", sdp: offer.sdp });
    await pc.setLocalDescription(await pc.createAnswer());
    await waitIceComplete(pc);
    return { connId: offer.connId, sdp: pc.localDescription?.sdp ?? "" };
  }

  send(_peerId: string, msg: PeerMessage): void {
    if (this.dc?.readyState === "open") this.dc.send(JSON.stringify(msg));
  }

  broadcast(msg: PeerMessage): void {
    this.send(GuestLinkTransport.HOST_ID, msg);
  }

  restartIce(): void {
    this.pc?.restartIce?.();
  }

  close(): void {
    this.pc?.close();
  }

  private wire(dc: RTCDataChannel): void {
    this.dc = dc;
    dc.onopen = () => this.stateCb?.(GuestLinkTransport.HOST_ID, "connected");
    dc.onclose = () => this.stateCb?.(GuestLinkTransport.HOST_ID, "closed");
    dc.onmessage = (e) => {
      try {
        this.msgCb?.(GuestLinkTransport.HOST_ID, JSON.parse(e.data as string) as PeerMessage);
      } catch {
        /* ignore malformed frame */
      }
    };
  }
}
