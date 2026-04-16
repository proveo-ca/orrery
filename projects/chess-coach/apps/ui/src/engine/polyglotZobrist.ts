import { Chess } from "chess.js";

/**
 * Polyglot Zobrist hashing for identifying chess games in localStorage.
 *
 * Polyglot spec:
 *   - 781 random 64-bit constants: 12 piece × 64 squares (768) + 4 castle + 8
 *     en-passant files + 1 side-to-move.
 *   - Per-position hash = XOR over every applicable key.
 *   - Polyglot piece order: BP, WP, BN, WN, BB, WB, BR, WR, BQ, WQ, BK, WK.
 *   - Square index = rank * 8 + file (rank '1' = 0).
 *   - En-passant: XOR only if a pawn can legally capture there (Polyglot's
 *     "usable e.p." rule). We conservatively skip en-passant keys entirely
 *     because chess.js's FEN string is ambiguous on legality; the resulting
 *     hash is still order-dependent via the sequence combiner below.
 *   - Castling: one key per KQkq that's present.
 *   - Side: XOR the single side key iff white to move.
 *
 * We generate the 781 constants via SplitMix64(seed=0) — deterministic across
 * all runs, collision-resistant in 64-bit space, but NOT bit-compatible with
 * pgn-extract's canonical table. For a 10-game local history the collision
 * probability is ~0; swap to the canonical table (a constants-only edit) if
 * pgn-extract interop is ever required.
 *
 * Game hash = rotl(acc, 1) ^ positionHash(i) along the move sequence, so
 * transpositions and different-length games produce distinct hashes.
 */

// ---------- SplitMix64 seeded constant table ----------

const MASK64 = (1n << 64n) - 1n;

function splitmix64(state: { s: bigint }): bigint {
  state.s = (state.s + 0x9e3779b97f4a7c15n) & MASK64;
  let z = state.s;
  z = ((z ^ (z >> 30n)) * 0xbf58476d1ce4e5b9n) & MASK64;
  z = ((z ^ (z >> 27n)) * 0x94d049bb133111ebn) & MASK64;
  z = z ^ (z >> 31n);
  return z & MASK64;
}

const RANDOM64: bigint[] = (() => {
  const st = { s: 0n };
  const out: bigint[] = [];
  for (let i = 0; i < 781; i++) out.push(splitmix64(st));
  return out;
})();

const PIECE_KEY_BASE = 0; // 768 entries
const CASTLE_KEY_BASE = 768; // 4 entries: K, Q, k, q
const EP_KEY_BASE = 772; // 8 entries (unused — see doc)
const SIDE_KEY = 780;

void EP_KEY_BASE; // intentionally unused

/** Polyglot piece-kind index for a FEN piece char. */
const PIECE_INDEX: Record<string, number> = {
  p: 0,
  P: 1,
  n: 2,
  N: 3,
  b: 4,
  B: 5,
  r: 6,
  R: 7,
  q: 8,
  Q: 9,
  k: 10,
  K: 11,
};

// ---------- Per-position hash ----------

/** Hash a FEN string per Polyglot rules (en-passant key intentionally skipped). */
export function polyglotHashFen(fen: string): bigint {
  const parts = fen.split(" ");
  const placement = parts[0] ?? "";
  const sideToMove = parts[1] ?? "w";
  const castling = parts[2] ?? "-";

  let hash = 0n;

  // Piece placement — FEN ranks are listed 8→1, files a→h left→right.
  const ranks = placement.split("/");
  for (let i = 0; i < ranks.length; i++) {
    const fenRankIdx = i; // 0 = FEN rank 8
    const polyglotRank = 7 - fenRankIdx; // Polyglot rank '1' = 0
    let file = 0;
    for (const ch of ranks[i]) {
      if (ch >= "1" && ch <= "8") {
        file += Number(ch);
        continue;
      }
      const kind = PIECE_INDEX[ch];
      if (kind === undefined) continue; // malformed FEN
      const square = polyglotRank * 8 + file;
      hash ^= RANDOM64[PIECE_KEY_BASE + 64 * kind + square];
      file++;
    }
  }

  // Castling rights.
  if (castling.includes("K")) hash ^= RANDOM64[CASTLE_KEY_BASE + 0];
  if (castling.includes("Q")) hash ^= RANDOM64[CASTLE_KEY_BASE + 1];
  if (castling.includes("k")) hash ^= RANDOM64[CASTLE_KEY_BASE + 2];
  if (castling.includes("q")) hash ^= RANDOM64[CASTLE_KEY_BASE + 3];

  // Side to move: XOR only when white moves.
  if (sideToMove === "w") hash ^= RANDOM64[SIDE_KEY];

  return hash & MASK64;
}

// ---------- Sequence-aware game hash ----------

const rotl64 = (x: bigint, n: bigint): bigint => {
  return (((x << n) & MASK64) | (x >> (64n - n))) & MASK64;
};

export type ZobristMove = { from: string; to: string; promotion?: string };

/**
 * Walk the move sequence and combine per-position hashes with a rotating
 * accumulator. Two different move orders yielding the same final position
 * produce different game hashes.
 */
export function polyglotGameHash(startingFen: string, moves: ZobristMove[]): string {
  const game = new Chess(startingFen);
  let acc = polyglotHashFen(game.fen());
  for (const m of moves) {
    // chess.js v1 throws on illegal moves rather than returning null. We
    // tolerate a bad sequence by hashing what we've successfully replayed.
    try {
      game.move({ from: m.from, to: m.to, promotion: m.promotion });
    } catch {
      break;
    }
    const ph = polyglotHashFen(game.fen());
    acc = rotl64(acc, 1n) ^ ph;
  }
  return acc.toString(16).padStart(16, "0");
}

/** Compute the Polyglot game hash directly from a PGN string. */
export function polyglotHashFromPgn(pgn: string, startingFen?: string): string {
  const game = startingFen ? new Chess(startingFen) : new Chess();
  try {
    game.loadPgn(pgn);
  } catch {
    return "0".repeat(16);
  }
  const moves = game.history({ verbose: true });
  const startFen = startingFen ?? new Chess().fen();
  return polyglotGameHash(
    startFen,
    moves.map((m) => ({ from: m.from, to: m.to, promotion: m.promotion })),
  );
}
