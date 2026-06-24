import { compressToEncodedURIComponent } from "lz-string";
import { describe, expect, it } from "vitest";

import { buildSignalLink, decodeSignal, encodeSignal, parseSignalHash } from "~/services/signaling";

describe("signaling codec", () => {
  const payload = {
    connId: "c1-ab3d9f",
    sdp: "v=0\r\no=- 1 1 IN IP4 100.64.0.1\r\ns=-\r\na=candidate:1 1 udp 2122 100.64.0.1 51820 typ host\r\n",
  };

  it("round-trips a payload through encode/decode", () => {
    expect(decodeSignal(encodeSignal(payload))).toEqual(payload);
  });

  it("produces url-safe base64 (no + / =)", () => {
    expect(encodeSignal(payload)).not.toMatch(/[+/=]/);
  });

  it("builds and parses an offer link", () => {
    const link = buildSignalLink("o", payload, "https://laptop.tail-scale.ts.net");
    expect(link.startsWith("https://laptop.tail-scale.ts.net/chess/lan#o=")).toBe(true);
    const hash = link.slice(link.indexOf("#"));
    expect(parseSignalHash(hash)).toEqual({ kind: "o", payload });
  });

  it("parses an answer link", () => {
    const link = buildSignalLink("a", payload, "https://laptop.ts.net");
    const hash = link.slice(link.indexOf("#"));
    expect(parseSignalHash(hash)).toEqual({ kind: "a", payload });
  });

  it("returns null for non-signaling or malformed hashes", () => {
    expect(parseSignalHash("#whatever")).toBeNull();
    expect(parseSignalHash("")).toBeNull();
    expect(parseSignalHash("#o=not-valid-base64-$$$")).toBeNull();
  });
});

describe("signaling codec · SDP minification", () => {
  // A realistic Chromium data-channel offer (Tailscale 100.x host candidate).
  const realSdp =
    [
      "v=0",
      "o=- 5809176200625910834 2 IN IP4 127.0.0.1",
      "s=-",
      "t=0 0",
      "a=group:BUNDLE 0",
      "a=extmap-allow-mixed",
      "a=msid-semantic: WMS",
      "m=application 9 UDP/DTLS/SCTP webrtc-datachannel",
      "c=IN IP4 0.0.0.0",
      "a=candidate:47366632 1 udp 2113937151 100.64.0.7 61767 typ host generation 0",
      "a=ice-ufrag:n3Ym",
      "a=ice-pwd:YQy2tRA6qwnuerMC8SzXOOsc",
      "a=ice-options:trickle",
      "a=fingerprint:sha-256 5F:86:B9:90:60:08:37:1D:81:A4:36:9D:3B:40:2C:57:77:81:8D:E9:FC:48:22:64:D6:5C:20:7D:F3:7F:83:72",
      "a=setup:actpass",
      "a=mid:0",
      "a=sctp-port:5000",
      "a=max-message-size:262144",
    ].join("\r\n") + "\r\n";
  const payload = { connId: "c1-ab3d9f", sdp: realSdp };

  it("preserves the connectivity-critical fields through minify → rebuild", () => {
    const out = decodeSignal(encodeSignal(payload));
    expect(out.connId).toBe("c1-ab3d9f");
    expect(out.sdp).toContain("a=ice-ufrag:n3Ym");
    expect(out.sdp).toContain("a=ice-pwd:YQy2tRA6qwnuerMC8SzXOOsc");
    expect(out.sdp).toContain(
      "a=fingerprint:sha-256 5F:86:B9:90:60:08:37:1D:81:A4:36:9D:3B:40:2C:57:77:81:8D:E9:FC:48:22:64:D6:5C:20:7D:F3:7F:83:72",
    );
    expect(out.sdp).toContain("a=setup:actpass");
    expect(out.sdp).toContain(
      "a=candidate:47366632 1 udp 2113937151 100.64.0.7 61767 typ host generation 0",
    );
    // The data-channel media section is intact and well-formed.
    expect(out.sdp).toContain("m=application 9 UDP/DTLS/SCTP webrtc-datachannel");
    expect(out.sdp).toContain("a=sctp-port:5000");
    expect(out.sdp.startsWith("v=0\r\n")).toBe(true);
  });

  it("is much smaller than shipping the full compressed SDP", () => {
    const minified = encodeSignal(payload).length;
    const full = compressToEncodedURIComponent(JSON.stringify(payload)).length;
    // Dropping the fixed boilerplate roughly halves the payload.
    expect(minified).toBeLessThan(full * 0.7);
  });

  it("falls back to the raw SDP when the minifiable fields are absent", () => {
    const raw = { connId: "c9", sdp: "v=0\r\no=- 1 1 IN IP4 0.0.0.0\r\ns=-\r\n" };
    expect(decodeSignal(encodeSignal(raw))).toEqual(raw);
  });
});
