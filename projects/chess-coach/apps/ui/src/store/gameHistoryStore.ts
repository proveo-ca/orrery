import { polyglotHashFromPgn } from "~/engine/polyglotZobrist";
import { createPersistedStore } from "~/store/createPersistedStore";

export type MoveRecord = {
  san: string;
  hasPressedHint: boolean;
  isAI: boolean;
};

export type GameResult = "win" | "loss" | "draw" | "ongoing";

export type GameRecord = {
  id: string;
  startedAt: string;
  endedAt: string | null;
  result: GameResult;
  pgn: string;
  startingFen: string;
  playerColor: "w" | "b";
  difficulty: string;
  moves: MoveRecord[];
};

type GameHistoryState = {
  games: GameRecord[]; // finalized, newest first, max 10
  inProgress: GameRecord | null;
};

const MAX_GAMES = 10;

const [state, setState] = createPersistedStore<GameHistoryState>("chess_coach_game_history", {
  games: [],
  inProgress: null,
});

// ---------- Selectors ----------

export const gameHistory = () => state.games;
export const inProgressGame = () => state.inProgress;

export const getGameById = (id: string): GameRecord | null => {
  if (state.inProgress && state.inProgress.id === id) return state.inProgress;
  return state.games.find((g) => g.id === id) ?? null;
};

// ---------- Mutations ----------

export const startNewRecord = (
  id: string,
  startingFen: string,
  playerColor: "w" | "b",
  difficulty: string,
) => {
  setState("inProgress", {
    id,
    startedAt: new Date().toISOString(),
    endedAt: null,
    result: "ongoing",
    pgn: "",
    startingFen,
    playerColor,
    difficulty,
    moves: [],
  });
};

export const pushMove = (move: MoveRecord) => {
  if (!state.inProgress) return;
  const moves = state.inProgress.moves;
  const last = moves[moves.length - 1];
  if (last && last.san === move.san && last.isAI === move.isAI) return;
  setState("inProgress", "moves", (prev) => [...prev, move]);
};

/** @deprecated No longer used — cpDelta is computed at review time. */
export const patchMoveAt = (index: number, patch: Partial<MoveRecord>) => {
  if (!state.inProgress) return;
  if (index < 0 || index >= state.inProgress.moves.length) return;
  setState("inProgress", "moves", index, (prev) => ({ ...prev, ...patch }));
};

/**
 * Embed per-move metadata as PGN comments so the PGN is self-contained.
 * Currently only `{hint}` is stored at recording time; cpDelta and
 * wasBestMove are computed fresh by Stockfish at review time.
 */
function annotatePgn(pgn: string, moves: MoveRecord[]): string {
  const tokens = pgn.match(/\{[^}]*\}|\d+\.\s*\.{2}|\d+\.|\S+/g);
  if (!tokens) return pgn;

  let moveIdx = 0;
  const out: string[] = [];

  for (const token of tokens) {
    out.push(token);

    if (/^\d+\./.test(token) || /^[{*]/.test(token) || /^[012/-]+$/.test(token)) continue;

    const rec = moves[moveIdx];
    moveIdx++;
    if (!rec || rec.isAI) continue;

    if (rec.hasPressedHint) out.push("{hint}");
  }

  return out.join(" ");
}

/**
 * Seal the in-progress record as finalized with `result` + `pgn`, unshift into
 * the history ring, evicting the oldest when the cap is exceeded. No-op if
 * there is no in-progress game (e.g., a game_over fired outside CoachScreen).
 *
 * On finalize the record's id is rewritten to the Polyglot-Zobrist hash of
 * the full move sequence (not the UUID it had while in-progress) so that
 * the URL `/review/:id` is stable and position-derived. Identical move
 * sequences would collide and replace the earlier entry — acceptable for
 * a 10-game personal review list.
 */
export const finalizeGame = (result: GameResult, pgn: string) => {
  const current = state.inProgress;
  if (!current) return;

  const annotatedPgn = annotatePgn(pgn, current.moves);
  const polyglotId = polyglotHashFromPgn(pgn, current.startingFen);

  const finalized: GameRecord = {
    ...current,
    id: polyglotId,
    result,
    pgn: annotatedPgn,
    endedAt: new Date().toISOString(),
  };

  setState((s) => ({
    games: [finalized, ...s.games.filter((g) => g.id !== polyglotId)].slice(0, MAX_GAMES),
    inProgress: null,
  }));
};

export const discardInProgress = () => {
  setState("inProgress", null);
};
