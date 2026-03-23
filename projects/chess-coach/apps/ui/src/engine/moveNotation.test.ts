import { describe, expect, it } from "vitest";

import { uciMatchesSan } from "~/engine/moveNotation";

describe("uciMatchesSan", () => {
  it("matches e2e4 with e4 in the starting position", () => {
    const fen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
    expect(uciMatchesSan(fen, "e2e4", "e4")).toBe(true);
  });

  it("matches g1f3 with Nf3 in the starting position", () => {
    const fen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
    expect(uciMatchesSan(fen, "g1f3", "Nf3")).toBe(true);
  });

  it("returns false for a mismatched SAN move", () => {
    const fen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
    expect(uciMatchesSan(fen, "e2e4", "d4")).toBe(false);
  });

  it("matches kingside castling", () => {
    const fen = "r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1";
    expect(uciMatchesSan(fen, "e1g1", "O-O")).toBe(true);
  });

  it("matches queenside castling", () => {
    const fen = "r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1";
    expect(uciMatchesSan(fen, "e1c1", "O-O-O")).toBe(true);
  });

  it("matches a capture move", () => {
    const fen = "4k3/8/8/3p4/4P3/8/8/4K3 w - - 0 1";
    expect(uciMatchesSan(fen, "e4d5", "exd5")).toBe(true);
  });

  it("matches a promotion move", () => {
    const fen = "4k3/4P3/8/8/8/8/8/4K3 w - - 0 1";
    expect(uciMatchesSan(fen, "e7e8q", "e8=Q+")).toBe(true);
  });

  it("returns false for invalid UCI", () => {
    const fen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
    expect(uciMatchesSan(fen, "a1a8", "Ra8")).toBe(false);
  });

  it("returns false for invalid FEN", () => {
    expect(uciMatchesSan("invalid fen", "e2e4", "e4")).toBe(false);
  });
});
