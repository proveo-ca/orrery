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
