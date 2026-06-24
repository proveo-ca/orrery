// SPEC: _spec/chess-coach/ui/components.puml
import { Chess } from "chess.js";
import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from "lz-string";

import { polyglotHashFromPgn } from "~/engine/polyglotZobrist";
import type { GameRecord, GameResult, MoveRecord } from "~/types/game";
import type { PlayerIdentity } from "~/types/settings";

/**
 * Serialize a recorded game into a compact, URL-safe string and back, for the
 * "share a game by link" feature. The payload rides in the URL *hash* (never
 * sent to the server) and is decoded into the recipient's localStorage.
 *
 * Shared games carry only bare moves and the two players' identities — no
 * coaching layer. The recomputable `id` and the whole `moves` array are left
 * out of the payload (the move list is rebuilt from the PGN on decode), and
 * `{hint}` annotations are stripped from the PGN, so hints never travel. The
 * per-game analysis cache (blunder arrows, best moves) is likewise not shared;
 * it is recomputed on the recipient's side. Dropping the redundant move list
 * roughly halves the URL length.
 *
 * Wire format: lz-string `compressToEncodedURIComponent(JSON.stringify({ v, g }))`,
 * where `g` is the GameRecord minus `id`, minus `moves`, and with PGN hint
 * markers stripped. `decodeGame` treats the input as fully hostile: it caps
 * sizes, validates every field, rebuilds a fresh object (never spreads
 * untrusted input — anti prototype-pollution), reconstructs the moves from the
 * PGN, and re-derives the `id` from the PGN.
 */

export const SHARE_VERSION = 1;

// Safety caps — bound URL length and guard against decompression bombs / abuse.
const MAX_ENCODED_PARAM_LEN = 32_000;
const MAX_DECODED_JSON_LEN = 512_000;
const MAX_MOVES = 1_000;
const MAX_PGN_LEN = 64_000;
const MAX_FEN_LEN = 128;
const MAX_STR_LEN = 128;

const ZERO_HASH = "0".repeat(16);
const RESULTS: readonly GameResult[] = ["win", "loss", "draw", "ongoing"];
const IDENTITIES: readonly PlayerIdentity[] = ["Human", "Cat", "Dog", "Rat"];

type ShareEnvelope = { v?: unknown; g?: unknown };

const clampStr = (v: unknown, max = MAX_STR_LEN): string | null =>
  typeof v === "string" && v.length <= max ? v : null;

/** Accept a valid ISO timestamp, else fall back (timestamps are cosmetic). */
const isoOr = (v: unknown, fallback: string | null): string | null => {
  if (typeof v === "string" && v.length <= 40 && !Number.isNaN(Date.parse(v))) return v;
  return fallback;
};

/** Strip `{hint}` (and any other) PGN comments so shared games carry bare moves. */
const stripPgnComments = (pgn: string): string => pgn.replace(/\{[^}]*\}\s*/g, "");

export function encodeGame(record: GameRecord): string {
  // The `id` is recomputed on decode and the `moves` list is reconstructed from
  // the PGN, so neither travels in the payload; hints are stripped from the PGN.
  const { id, moves, pgn, ...rest } = record;
  void id;
  void moves;
  const g = { ...rest, pgn: stripPgnComments(pgn) };
  return compressToEncodedURIComponent(JSON.stringify({ v: SHARE_VERSION, g }));
}

/**
 * Rebuild the move list from a shared game's bare PGN. Mirrors gameStore's
 * `loadGame` (`new Chess(fen)` → `loadPgn`) so the recipient replays the same
 * moves. Hints are intentionally not shared, so `hasPressedHint` is always
 * false; `isAI` is whichever side isn't the sharer's `playerColor`. Returns
 * null on an illegal starting FEN or an unparseable PGN.
 */
function movesFromPgn(
  pgn: string,
  startingFen: string,
  playerColor: "w" | "b",
): MoveRecord[] | null {
  let game: Chess;
  try {
    game = new Chess(startingFen);
  } catch {
    return null;
  }
  try {
    game.loadPgn(pgn);
  } catch {
    return null;
  }
  return game.history({ verbose: true }).map((m) => ({
    san: m.san,
    hasPressedHint: false,
    isAI: m.color !== playerColor,
  }));
}

export function decodeGame(param: string): GameRecord | null {
  if (!param || param.length > MAX_ENCODED_PARAM_LEN) return null;

  const json = decompressFromEncodedURIComponent(param);
  if (!json || json.length > MAX_DECODED_JSON_LEN) return null;

  let parsed: ShareEnvelope;
  try {
    parsed = JSON.parse(json) as ShareEnvelope;
  } catch {
    return null;
  }
  if (!parsed || parsed.v !== SHARE_VERSION || typeof parsed.g !== "object" || parsed.g === null) {
    return null;
  }
  const g = parsed.g as Record<string, unknown>;

  // Required fields — strictly validated.
  const pgn = clampStr(g.pgn, MAX_PGN_LEN);
  const startingFen = clampStr(g.startingFen, MAX_FEN_LEN);
  const difficulty = clampStr(g.difficulty, MAX_STR_LEN);
  if (pgn === null || startingFen === null || difficulty === null) return null;
  if (g.playerColor !== "w" && g.playerColor !== "b") return null;
  if (!RESULTS.includes(g.result as GameResult)) return null;

  // Rebuild the move list from the bare PGN (also validates the FEN + PGN).
  const moves = movesFromPgn(pgn, startingFen, g.playerColor);
  if (moves === null || moves.length > MAX_MOVES) return null;

  // Re-derive the review id; reject a PGN that doesn't parse.
  const id = polyglotHashFromPgn(pgn, startingFen);
  if (id === ZERO_HASH) return null;

  const record: GameRecord = {
    id,
    startedAt: isoOr(g.startedAt, new Date().toISOString())!,
    endedAt: g.endedAt === null ? null : isoOr(g.endedAt, null),
    result: g.result as GameResult,
    pgn,
    startingFen,
    playerColor: g.playerColor,
    difficulty,
    moves,
  };

  // Optional display/identity fields — dropped if absent or malformed.
  const playerName = clampStr(g.playerName);
  if (playerName !== null) record.playerName = playerName;
  const opponentName = clampStr(g.opponentName);
  if (opponentName !== null) record.opponentName = opponentName;
  if (IDENTITIES.includes(g.playerRace as PlayerIdentity)) {
    record.playerRace = g.playerRace as PlayerIdentity;
  }
  if (IDENTITIES.includes(g.opponentRace as PlayerIdentity)) {
    record.opponentRace = g.opponentRace as PlayerIdentity;
  }

  return record;
}

/**
 * Absolute, shareable URL carrying the game in the hash fragment, e.g.
 * `https://host/chess/review#g=<payload>`. The fragment is never transmitted
 * to the server. `BASE_URL` is Vite's `/chess/`.
 */
export function buildShareUrl(record: GameRecord): string {
  return `${window.location.origin}${import.meta.env.BASE_URL}review#g=${encodeGame(record)}`;
}
