import { polyglotHashFromPgn } from "~/engine/polyglotZobrist";
import { deleteAnalysisCache } from "~/hooks/useGameAnalysis";
import { createPersistedStore } from "~/store/createPersistedStore";
import type { PlayerIdentity } from "~/store/settingsStore";

export const getExpectedReviewId = (pgn: string, fen: string): string =>
  polyglotHashFromPgn(pgn, fen);

export const hasRecordedReview = (pgn: string, fen: string): boolean =>
  getGameById(polyglotHashFromPgn(pgn, fen)) !== null;

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
  playerRace?: PlayerIdentity;
  opponentRace?: PlayerIdentity;
  opponentName?: string;
};

type GameHistoryState = {
  games: GameRecord[];
  inProgress: GameRecord | null;
};

const MAX_GAMES = 1000;

const [state, setState] = createPersistedStore<GameHistoryState>("chess_coach_game_history", {
  games: [],
  inProgress: null,
});

export const gameHistory = () => state.games;
export const inProgressGame = () => state.inProgress;

export const getGameById = (id: string): GameRecord | null => {
  if (state.inProgress && state.inProgress.id === id) return state.inProgress;
  return state.games.find((g) => g.id === id) ?? null;
};

export const startNewRecord = (
  id: string,
  startingFen: string,
  playerColor: "w" | "b",
  difficulty: string,
  playerRace?: PlayerIdentity,
  opponentRace?: PlayerIdentity,
) => {
  const opponentName = opponentRace
    ? `Selena (${difficulty.charAt(0).toUpperCase() + difficulty.slice(1)})`
    : undefined;

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
    playerRace,
    opponentRace,
    opponentName,
  });
};

export const pushMove = (move: MoveRecord) => {
  if (!state.inProgress) return;
  const moves = state.inProgress.moves;
  const last = moves[moves.length - 1];
  if (last && last.san === move.san && last.isAI === move.isAI) return;
  setState("inProgress", "moves", (prev) => [...prev, move]);
};

export const patchMoveAt = (index: number, patch: Partial<MoveRecord>) => {
  if (!state.inProgress) return;
  if (index < 0 || index >= state.inProgress.moves.length) return;
  setState("inProgress", "moves", index, (prev) => ({ ...prev, ...patch }));
};

function annotatePgn(pgn: string, moves: MoveRecord[]): string {
  // Preserve PGN headers before the first blank line; only annotate the move body.
  // chess.js's game.pgn() emits [Event "?"] headers, and the old code treated
  // header tokens as moves, corrupting the PGN with misplaced {hint} markers.
  const blankMatch = pgn.match(/\n\s*\n/);
  const prefix = blankMatch ? pgn.slice(0, blankMatch.index! + blankMatch[0].length) : "";
  const body = blankMatch
    ? pgn.slice(blankMatch.index! + blankMatch[0].length).trim()
    : pgn.trim();

  const tokens = body.match(/\{[^}]*\}|\d+\.\s*\.{2}|\d+\.|\S+/g);
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

  return prefix + out.join(" ");
}

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

  setState((s) => {
    const kept = [finalized, ...s.games.filter((g) => g.id !== polyglotId)];
    const evicted = kept.slice(MAX_GAMES);
    for (const g of evicted) deleteAnalysisCache(g.id);
    return { games: kept.slice(0, MAX_GAMES), inProgress: null };
  });
};

export const discardInProgress = () => {
  setState("inProgress", null);
};
