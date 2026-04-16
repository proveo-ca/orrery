import { describe, expect, it } from "vitest";

import { polyglotGameHash, polyglotHashFen, polyglotHashFromPgn } from "~/engine/polyglotZobrist";

const STARTING_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

describe("polyglotZobrist", () => {
  it("is deterministic: same FEN -> same hash across calls", () => {
    const a = polyglotHashFen(STARTING_FEN);
    const b = polyglotHashFen(STARTING_FEN);
    expect(a).toBe(b);
  });

  it("produces distinct hashes for different positions", () => {
    const a = polyglotHashFen(STARTING_FEN);
    const b = polyglotHashFen("rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2");
    expect(a).not.toBe(b);
  });

  it("distinguishes side-to-move", () => {
    const white = polyglotHashFen(STARTING_FEN);
    const black = polyglotHashFen(STARTING_FEN.replace(" w ", " b "));
    expect(white).not.toBe(black);
  });

  it("distinguishes castling rights", () => {
    const full = polyglotHashFen(STARTING_FEN);
    const noCastle = polyglotHashFen(STARTING_FEN.replace(" KQkq ", " - "));
    expect(full).not.toBe(noCastle);
  });

  it("game hash is a 16-hex-char string", () => {
    const h = polyglotGameHash(STARTING_FEN, []);
    expect(h).toMatch(/^[0-9a-f]{16}$/);
  });

  it("game hash is order-sensitive: transpositions differ", () => {
    // Legal transposition: both reach the same 2-move position, different orders.
    // 1.Nf3 d5 2.c4 vs 1.c4 d5 2.Nf3  — same board after move 2.
    const a = polyglotGameHash(STARTING_FEN, [
      { from: "g1", to: "f3" },
      { from: "d7", to: "d5" },
      { from: "c2", to: "c4" },
    ]);
    const b = polyglotGameHash(STARTING_FEN, [
      { from: "c2", to: "c4" },
      { from: "d7", to: "d5" },
      { from: "g1", to: "f3" },
    ]);
    expect(a).not.toBe(b);
  });

  it("game hash differs from empty game (at least one move applied)", () => {
    const empty = polyglotGameHash(STARTING_FEN, []);
    const withMove = polyglotGameHash(STARTING_FEN, [{ from: "e2", to: "e4" }]);
    expect(empty).not.toBe(withMove);
  });

  it("polyglotHashFromPgn matches a replayed polyglotGameHash", () => {
    const pgn = "1. e4 e5 2. Nf3 Nc6";
    const fromPgn = polyglotHashFromPgn(pgn);
    const fromMoves = polyglotGameHash(STARTING_FEN, [
      { from: "e2", to: "e4" },
      { from: "e7", to: "e5" },
      { from: "g1", to: "f3" },
      { from: "b8", to: "c6" },
    ]);
    expect(fromPgn).toBe(fromMoves);
  });
});
