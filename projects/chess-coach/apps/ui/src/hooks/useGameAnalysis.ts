import { Chess } from "chess.js";
import { createEffect, createSignal, on, onCleanup } from "solid-js";

import { enginePool, type EvalResult } from "~/engine/EnginePool";
import type { GameRecord } from "~/store/gameHistoryStore";

/** Search depth for review analysis. Shared by the Review screen and the
 *  CoachScreen live pre-analysis so both write interchangeable cache entries. */
export const ANALYSIS_DEPTH = 20;
/** How many ply-pairs to keep in flight; the pool bounds real worker concurrency. */
const MAX_ANALYSIS_LANES = 3;
/** Persist + emit progress after this many freshly-analyzed plies. */
const FLUSH_EVERY = 2;

export type PositionEval = { kind: "cp" | "mate"; value: number };

export type GameAnalysis = {
  cpDeltas: (number | null)[];
  wasBestMoves: boolean[];
  bestMoveUcis: (string | null)[];
  loading: boolean;
};

const EMPTY: GameAnalysis = { cpDeltas: [], wasBestMoves: [], bestMoveUcis: [], loading: false };

const CACHE_PREFIX = "chess_coach_analysis_";
const CACHE_VERSION = 5;

type CachedAnalysis = {
  version: typeof CACHE_VERSION;
  cpDeltas: (number | null)[];
  wasBestMoves: boolean[];
  bestMoveUcis: (string | null)[];
  analyzed: boolean[];
  complete: boolean;
};

type AnalysisState = Omit<GameAnalysis, "loading"> & {
  analyzed: boolean[];
};

type ReviewJob = {
  ply: number;
  beforeFen: string;
  playedUci: string;
};

function readCache(gameId: string): CachedAnalysis | null {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + gameId);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CachedAnalysis>;
    if (parsed.version !== CACHE_VERSION) return null;
    if (
      !Array.isArray(parsed.cpDeltas) ||
      !Array.isArray(parsed.wasBestMoves) ||
      !Array.isArray(parsed.bestMoveUcis) ||
      !Array.isArray(parsed.analyzed)
    ) {
      return null;
    }
    return parsed as CachedAnalysis;
  } catch {
    return null;
  }
}

function writeCache(gameId: string, data: CachedAnalysis): void {
  try {
    localStorage.setItem(CACHE_PREFIX + gameId, JSON.stringify(data));
  } catch {}
}

export function deleteAnalysisCache(gameId: string): void {
  try {
    localStorage.removeItem(CACHE_PREFIX + gameId);
  } catch {}
}

/**
 * Move a cache entry from one game id to another. The live pre-analysis on
 * CoachScreen writes under the in-progress game's (stable) UUID, but
 * `finalizeGame` rekeys the finished game to a sequence-hash id — this
 * carries the warmed analysis across so Review opens warm.
 */
export function migrateAnalysisCache(fromId: string, toId: string): void {
  if (fromId === toId) return;
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + fromId);
    if (raw !== null) localStorage.setItem(CACHE_PREFIX + toId, raw);
    localStorage.removeItem(CACHE_PREFIX + fromId);
  } catch {}
}

const scoreToCp = (s: PositionEval): number =>
  s.kind === "mate" ? (s.value > 0 ? 10000 : -10000) : s.value;

function scoreToPlayerCp(score: PositionEval, fen: string, playerColor: "w" | "b"): number {
  // Stockfish reports score for the side to move; flip when that side is not
  // the reviewed player so positive deltas are always good for the player.
  const sideToMove = fen.split(" ")[1];
  const cp = scoreToCp(score);
  return sideToMove === playerColor ? cp : -cp;
}

function buildReviewJobs(game: GameRecord): ReviewJob[] {
  const chess = new Chess(game.startingFen);
  const jobs: ReviewJob[] = [];

  game.moves.forEach((m, ply) => {
    const beforeFen = chess.fen();
    try {
      const result = chess.move(m.san);
      if (result && result.color === game.playerColor) {
        jobs.push({
          ply,
          beforeFen,
          playedUci: `${result.from}${result.to}${result.promotion ?? ""}`,
        });
      }
    } catch {
      // Keep later parsing aligned as best-effort; malformed legacy PGNs
      // simply leave the affected ply unanalyzed.
    }
  });

  return jobs;
}

function seedFromCache(cached: CachedAnalysis | null, moveCount: number): AnalysisState {
  if (
    cached &&
    cached.cpDeltas.length === moveCount &&
    cached.wasBestMoves.length === moveCount &&
    cached.bestMoveUcis.length === moveCount &&
    cached.analyzed.length === moveCount
  ) {
    return {
      cpDeltas: [...cached.cpDeltas],
      wasBestMoves: [...cached.wasBestMoves],
      bestMoveUcis: [...cached.bestMoveUcis],
      analyzed: [...cached.analyzed],
    };
  }

  return {
    cpDeltas: Array.from({ length: moveCount }, () => null),
    wasBestMoves: Array.from({ length: moveCount }, () => false),
    bestMoveUcis: Array.from({ length: moveCount }, () => null),
    analyzed: Array.from({ length: moveCount }, () => false),
  };
}

function sanitizeNonPlayerPlies(
  game: GameRecord,
  state: AnalysisState,
): void {
  const chess = new Chess(game.startingFen);
  for (let i = 0; i < game.moves.length; i++) {
    const m = game.moves[i];
    try {
      const result = chess.move(m.san);
      if (result && result.color !== game.playerColor) {
        state.cpDeltas[i] = null;
        state.wasBestMoves[i] = false;
        state.bestMoveUcis[i] = null;
        state.analyzed[i] = false;
      }
    } catch {
      // ignore malformed; leave as-is
    }
  }
}

function applyJobResult(
  state: AnalysisState,
  job: ReviewJob,
  playerColor: "w" | "b",
  best: EvalResult,
  played: EvalResult,
): void {
  const bestCp = best.score ? scoreToPlayerCp(best.score, job.beforeFen, playerColor) : null;
  const playedCp = played.score ? scoreToPlayerCp(played.score, job.beforeFen, playerColor) : null;
  state.cpDeltas[job.ply] = bestCp != null && playedCp != null ? playedCp - bestCp : null;
  state.bestMoveUcis[job.ply] = best.bestMove;
  state.wasBestMoves[job.ply] = best.bestMove != null && job.playedUci === best.bestMove;
  state.analyzed[job.ply] = true;
}

/**
 * Analyze every player ply of `game` through the shared engine pool at
 * background priority, persisting progress to the localStorage cache that
 * `useGameAnalysis` reads. Interactive searches (hint/hover) preempt these
 * jobs, so it is safe to run during a live game — which is exactly what the
 * CoachScreen pre-analysis does, leaving the Review screen warm.
 *
 * `onState` fires on the seeded state, on every {@link FLUSH_EVERY} freshly
 * analyzed plies, and once more when complete (`final = true`).
 */
export async function analyzeGameToCache(
  game: GameRecord,
  opts: { signal: AbortSignal; onState?: (state: AnalysisState, final: boolean) => void },
): Promise<void> {
  const { signal, onState } = opts;
  const jobs = buildReviewJobs(game);
  const state = seedFromCache(readCache(game.id), game.moves.length);
  sanitizeNonPlayerPlies(game, state);

  const persist = (final: boolean) => {
    sanitizeNonPlayerPlies(game, state);
    writeCache(game.id, {
      version: CACHE_VERSION,
      cpDeltas: [...state.cpDeltas],
      wasBestMoves: [...state.wasBestMoves],
      bestMoveUcis: [...state.bestMoveUcis],
      analyzed: [...state.analyzed],
      complete: final,
    });
    onState?.(state, final);
  };

  const pending = jobs.filter((job) => !state.analyzed[job.ply]);
  if (pending.length === 0) {
    persist(true);
    return;
  }

  // Paint the seeded (possibly partial) cache immediately.
  onState?.(state, false);

  let completed = 0;
  let cursor = 0;
  const runLane = async (): Promise<void> => {
    while (cursor < pending.length) {
      if (signal.aborted) return;
      const job = pending[cursor++];
      try {
        const [best, played] = await Promise.all([
          enginePool.evaluate({
            fen: job.beforeFen,
            depth: ANALYSIS_DEPTH,
            priority: "background",
            signal,
          }),
          enginePool.evaluate({
            fen: job.beforeFen,
            depth: ANALYSIS_DEPTH,
            searchMoves: [job.playedUci],
            priority: "background",
            signal,
          }),
        ]);
        applyJobResult(state, job, game.playerColor, best, played);
        completed++;
        if (completed % FLUSH_EVERY === 0) persist(false);
      } catch {
        // Aborted or a worker fault for this ply — stop on abort, otherwise
        // leave the ply unanalyzed and move on.
        if (signal.aborted) return;
      }
    }
  };

  const lanes = Math.min(MAX_ANALYSIS_LANES, pending.length);
  await Promise.all(Array.from({ length: lanes }, runLane));
  if (!signal.aborted) persist(true);
}

export function useGameAnalysis(game: () => GameRecord | null) {
  const [analysis, setAnalysis] = createSignal<GameAnalysis>(EMPTY);

  let controller: AbortController | null = null;
  const stop = () => {
    controller?.abort();
    controller = null;
  };
  onCleanup(stop);

  createEffect(
    on(game, (g) => {
      stop();
      if (!g || g.moves.length === 0) {
        setAnalysis(EMPTY);
        return;
      }

      controller = new AbortController();
      const gameId = g.id;
      const emit = (state: AnalysisState, final: boolean) => {
        if (game()?.id !== gameId) return;
        setAnalysis({
          cpDeltas: [...state.cpDeltas],
          wasBestMoves: [...state.wasBestMoves],
          bestMoveUcis: [...state.bestMoveUcis],
          loading: !final,
        });
      };

      void analyzeGameToCache(g, { signal: controller.signal, onState: emit }).catch(() => {});
    }),
  );

  return analysis;
}
