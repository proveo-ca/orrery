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
 * Wire format: lz-string `compressToEncodedURIComponent(JSON.stringify({ v, g }))`,
 * where `g` is the GameRecord minus its recomputable `id`. `decodeGame` treats
 * the input as fully hostile: it caps sizes, validates every field, builds a
 * fresh object (never spreads untrusted input — anti prototype-pollution), and
 * re-derives the `id` from the PGN. The per-game analysis cache is intentionally
 * NOT shared; it is recomputed on the recipient's side.
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

export function encodeGame(record: GameRecord): string {
  const { id, ...rest } = record;
  void id; // recomputed on decode — never travels in the payload
  return compressToEncodedURIComponent(JSON.stringify({ v: SHARE_VERSION, g: rest }));
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
  if (!Array.isArray(g.moves) || g.moves.length > MAX_MOVES) return null;

  // Starting position must be a legal FEN (chess.js throws otherwise).
  try {
    new Chess(startingFen);
  } catch {
    return null;
  }

  const moves: MoveRecord[] = [];
  for (const m of g.moves) {
    if (typeof m !== "object" || m === null) return null;
    const mm = m as Record<string, unknown>;
    const san = clampStr(mm.san, MAX_STR_LEN);
    if (san === null) return null;
    moves.push({ san, hasPressedHint: mm.hasPressedHint === true, isAI: mm.isAI === true });
  }

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
