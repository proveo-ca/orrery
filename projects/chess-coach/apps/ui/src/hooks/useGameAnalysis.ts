import { Chess } from "chess.js";
import { createEffect, createSignal, on, onCleanup } from "solid-js";

import { DEFAULT_STOCKFISH_WORKER_URL } from "~/engine/StockfishEngine.ts";
import { parseStockfishMessage } from "~/utils/stockfishParser";
import type { GameRecord } from "~/store/gameHistoryStore";

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

const allJobsAnalyzed = (jobs: ReviewJob[], analyzed: boolean[]) =>
  jobs.every((job) => analyzed[job.ply]);

function runQueuedAnalysis(
  jobs: ReviewJob[],
  state: AnalysisState,
  playerColor: "w" | "b",
  isAborted: () => boolean,
  onProgress: (final: boolean) => void,
  onDone: () => void,
): () => void {
  const pendingJobs = jobs.filter((job) => !state.analyzed[job.ply]);
  if (pendingJobs.length === 0) {
    onDone();
    return () => {};
  }

  const workerCount = Math.min(2, pendingJobs.length);
  const workers: Worker[] = [];
  let nextJobIndex = 0;
  let completedJobs = 0;
  let finishedWorkers = 0;

  for (let w = 0; w < workerCount; w++) {
    const worker = new Worker(DEFAULT_STOCKFISH_WORKER_URL);
    workers.push(worker);
    worker.postMessage("uci");
    worker.postMessage("isready");

    let currentJob: ReviewJob | null = null;
    let phase: "best" | "played" = "best";
    let bestScore: PositionEval | null = null;
    let beforeBestMove: string | null = null;
    let latestScore: PositionEval | null = null;

    const evalFen = (fen: string, searchMove?: string) => {
      latestScore = null;
      worker.postMessage("ucinewgame");
      worker.postMessage(`position fen ${fen}`);
      worker.postMessage(searchMove ? `go depth 20 searchmoves ${searchMove}` : "go depth 20");
    };

    const evalNextJob = () => {
      if (nextJobIndex >= pendingJobs.length) {
        finishedWorkers++;
        worker.terminate();
        if (finishedWorkers === workerCount) onDone();
        return;
      }

      currentJob = pendingJobs[nextJobIndex++];
      phase = "best";
      bestScore = null;
      beforeBestMove = null;
      evalFen(currentJob.beforeFen);
    };

    worker.onmessage = (event: MessageEvent) => {
      if (isAborted()) {
        worker.terminate();
        return;
      }

      const raw = event.data;
      if (typeof raw !== "string") return;

      const msg = parseStockfishMessage(raw);

      if (msg.type === "info" && msg.score) {
        latestScore = msg.score;
        return;
      }

      if (msg.type === "bestmove") {
        const uci = msg.move && msg.move !== "(none)" ? msg.move : null;
        if (!currentJob) return;

        if (phase === "best") {
          bestScore = latestScore;
          beforeBestMove = uci;
          phase = "played";
          evalFen(currentJob.beforeFen, currentJob.playedUci);
          return;
        }

        const playedScore = latestScore;
        const ply = currentJob.ply;
        const bestCp = bestScore
          ? scoreToPlayerCp(bestScore, currentJob.beforeFen, playerColor)
          : null;
        const playedCp = playedScore
          ? scoreToPlayerCp(playedScore, currentJob.beforeFen, playerColor)
          : null;

        state.cpDeltas[ply] = bestCp != null && playedCp != null ? playedCp - bestCp : null;
        state.bestMoveUcis[ply] = beforeBestMove;
        state.wasBestMoves[ply] = beforeBestMove != null && currentJob.playedUci === beforeBestMove;
        state.analyzed[ply] = true;
        completedJobs++;

        if (completedJobs % 2 === 0 || completedJobs >= pendingJobs.length) {
          onProgress(completedJobs >= pendingJobs.length);
        }
        evalNextJob();
      }
    };

    evalNextJob();
  }

  return () => workers.forEach((worker) => worker.terminate());
}

export function useGameAnalysis(game: () => GameRecord | null) {
  const [analysis, setAnalysis] = createSignal<GameAnalysis>(EMPTY);

  let _aborted = false;
  let cancelAnalysis = () => {};

  const cleanup = () => {
    _aborted = true;
    cancelAnalysis();
    cancelAnalysis = () => {};
  };

  onCleanup(cleanup);

  const flush = (gameId: string, state: AnalysisState, final: boolean) => {
    if (_aborted) return;

    const g = game();
    if (!g || g.id !== gameId) return;

    sanitizeNonPlayerPlies(g, state);

    setAnalysis({
      cpDeltas: [...state.cpDeltas],
      wasBestMoves: [...state.wasBestMoves],
      bestMoveUcis: [...state.bestMoveUcis],
      loading: !final,
    });
    writeCache(gameId, {
      version: CACHE_VERSION,
      cpDeltas: [...state.cpDeltas],
      wasBestMoves: [...state.wasBestMoves],
      bestMoveUcis: [...state.bestMoveUcis],
      analyzed: [...state.analyzed],
      complete: final,
    });
  };

  createEffect(
    on(game, (g) => {
      cleanup();
      if (!g || g.moves.length === 0) {
        setAnalysis(EMPTY);
        return;
      }

      _aborted = false;
      const jobs = buildReviewJobs(g);
      const cached = readCache(g.id);
      const state = seedFromCache(cached, g.moves.length);
      sanitizeNonPlayerPlies(g, state);
      const final = allJobsAnalyzed(jobs, state.analyzed);

      if (cached?.complete && final) {
        setAnalysis({
          cpDeltas: [...state.cpDeltas],
          wasBestMoves: [...state.wasBestMoves],
          bestMoveUcis: [...state.bestMoveUcis],
          loading: false,
        });
        return;
      }

      setAnalysis({
        cpDeltas: [...state.cpDeltas],
        wasBestMoves: [...state.wasBestMoves],
        bestMoveUcis: [...state.bestMoveUcis],
        loading: !final,
      });

      if (final) {
        flush(g.id, state, true);
        return;
      }

      cancelAnalysis = runQueuedAnalysis(
        jobs,
        state,
        g.playerColor,
        () => _aborted,
        (final) => flush(g.id, state, final),
        () => flush(g.id, state, true),
      );
    }),
  );

  return analysis;
}
