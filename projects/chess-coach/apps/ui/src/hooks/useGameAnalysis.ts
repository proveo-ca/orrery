// SPEC: _spec/chess-coach/ui/components.puml
import { Chess } from "chess.js";
import { createEffect, createSignal, on, onCleanup } from "solid-js";

import { DEFAULT_STOCKFISH_WORKER_URL } from "~/engine/StockfishEngine.ts";
import type { GameRecord } from "~/store/gameHistoryStore";

export type PositionEval = { kind: "cp" | "mate"; value: number };

export type GameAnalysis = {
  /** Per-ply cpDelta from the moving side's perspective. null while pending. */
  cpDeltas: (number | null)[];
  /** Per-ply: was this the engine's top choice? */
  wasBestMoves: boolean[];
  /** Per-ply: engine's best move in UCI notation. */
  bestMoveUcis: (string | null)[];
  /** True while any positions are still being evaluated. */
  loading: boolean;
};

const EMPTY: GameAnalysis = { cpDeltas: [], wasBestMoves: [], bestMoveUcis: [], loading: false };

// ── Analysis cache (localStorage) ─────────────────────────────────────

const CACHE_PREFIX = "chess_coach_analysis_";

type CachedAnalysis = {
  evals: (PositionEval | null)[];
  bestMoveUcis: (string | null)[];
  complete: boolean;
};

function readCache(gameId: string): CachedAnalysis | null {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + gameId);
    if (!raw) return null;
    return JSON.parse(raw) as CachedAnalysis;
  } catch {
    return null;
  }
}

function writeCache(gameId: string, data: CachedAnalysis): void {
  try {
    localStorage.setItem(CACHE_PREFIX + gameId, JSON.stringify(data));
  } catch {
    // localStorage full — silently ignore
  }
}

export function deleteAnalysisCache(gameId: string): void {
  try {
    localStorage.removeItem(CACHE_PREFIX + gameId);
  } catch {
    // ignore
  }
}

// ── Shared helpers ────────────────────────────────────────────────────

const scoreToCp = (s: PositionEval): number =>
  s.kind === "mate" ? (s.value > 0 ? 10000 : -10000) : s.value;

function deriveAnalysis(
  moves: GameRecord["moves"],
  evals: (PositionEval | null)[],
  bestMoveUcis: (string | null)[],
  playedUcis: string[],
): Omit<GameAnalysis, "loading"> {
  const cpDeltas: (number | null)[] = [];
  const wasBestMoves: boolean[] = [];
  const perPlyBestMoves: (string | null)[] = [];

  for (let i = 0; i < moves.length; i++) {
    const before = evals[i];
    const after = evals[i + 1];
    if (before && after) {
      cpDeltas.push(-scoreToCp(after) - scoreToCp(before));
    } else {
      cpDeltas.push(null);
    }
    const bestUci = bestMoveUcis[i];
    wasBestMoves.push(bestUci != null && playedUcis[i] === bestUci);
    perPlyBestMoves.push(bestUci ?? null);
  }

  return { cpDeltas, wasBestMoves, bestMoveUcis: perPlyBestMoves };
}

/**
 * Batch-evaluate every position in a saved game via a dedicated Stockfish
 * worker. Results are cached in localStorage per game so repeat visits
 * skip the engine entirely. Partial results are written progressively
 * (every 4 positions) so interrupted analyses resume where they left off.
 *
 * For each ply we need the eval BEFORE the move (to compute delta and
 * best-move). We evaluate positions 0..N (N+1 evals for N moves), then:
 *   cpDelta[i] = -eval[i+1] - eval[i]   (flip for side-to-move change)
 *   wasBestMove[i] = (played move === engine's bestmove on position i)
 */
export function useGameAnalysis(game: () => GameRecord | null) {
  const [analysis, setAnalysis] = createSignal<GameAnalysis>(EMPTY);

  let worker: Worker | null = null;
  let aborted = false;

  const cleanup = () => {
    aborted = true;
    worker?.terminate();
    worker = null;
  };

  onCleanup(cleanup);

  createEffect(
    on(game, (g) => {
      cleanup();
      if (!g || g.moves.length === 0) {
        setAnalysis(EMPTY);
        return;
      }

      aborted = false;

      // Rebuild FEN list: fens[0] = starting, fens[i+1] = after move i.
      const chess = new Chess(g.startingFen);
      const fens = [chess.fen()];
      const playedUcis: string[] = [];
      for (const m of g.moves) {
        try {
          const result = chess.move(m.san);
          fens.push(chess.fen());
          playedUcis.push(result ? `${result.from}${result.to}${result.promotion ?? ""}` : "");
        } catch {
          fens.push(fens[fens.length - 1]);
          playedUcis.push("");
        }
      }

      // Check cache before spawning a worker.
      const cached = readCache(g.id);
      if (cached && cached.complete && cached.evals.length === fens.length) {
        const derived = deriveAnalysis(g.moves, cached.evals, cached.bestMoveUcis, playedUcis);
        setAnalysis({ ...derived, loading: false });
        return;
      }

      // Seed from partial cache or start fresh.
      const evals: (PositionEval | null)[] =
        cached && cached.evals.length === fens.length
          ? [...cached.evals]
          : Array.from({ length: fens.length }, () => null);
      const bestMoveUcis: (string | null)[] =
        cached && cached.bestMoveUcis.length === fens.length
          ? [...cached.bestMoveUcis]
          : Array.from({ length: fens.length }, () => null);

      let currentPos = evals.findIndex((e) => e === null);
      if (currentPos < 0) currentPos = fens.length; // all filled — shouldn't happen but safe

      // Show partial results immediately if resuming.
      const initial = deriveAnalysis(g.moves, evals, bestMoveUcis, playedUcis);
      setAnalysis({ ...initial, loading: true });

      // Evaluate remaining positions sequentially via a dedicated worker.
      worker = new Worker(DEFAULT_STOCKFISH_WORKER_URL);
      worker.postMessage("uci");
      worker.postMessage("isready");

      let latestScore: PositionEval | null = null;

      const evalNext = () => {
        if (aborted || !worker || currentPos >= fens.length) {
          if (!aborted) flush(true);
          return;
        }
        latestScore = null;
        worker.postMessage("ucinewgame");
        worker.postMessage(`position fen ${fens[currentPos]}`);
        worker.postMessage("go depth 20");
      };

      const flush = (final: boolean = false) => {
        const derived = deriveAnalysis(g.moves, evals, bestMoveUcis, playedUcis);
        setAnalysis({ ...derived, loading: !final });
        writeCache(g.id, { evals: [...evals], bestMoveUcis: [...bestMoveUcis], complete: final });
      };

      worker.onmessage = (event: MessageEvent) => {
        const raw = event.data;
        if (typeof raw !== "string") return;

        if (raw.startsWith("info ")) {
          const scoreMatch = /\bscore (cp|mate) (-?\d+)/.exec(raw);
          if (scoreMatch) {
            latestScore = { kind: scoreMatch[1] as "cp" | "mate", value: Number(scoreMatch[2]) };
          }
          return;
        }

        if (raw.startsWith("bestmove")) {
          evals[currentPos] = latestScore;
          const uci = raw.trim().split(/\s+/)[1] ?? "";
          bestMoveUcis[currentPos] = uci && uci !== "(none)" ? uci : null;
          currentPos++;

          // Flush partial results periodically so the UI updates.
          if (currentPos % 4 === 0 || currentPos >= fens.length) flush(currentPos >= fens.length);

          evalNext();
        }
      };

      evalNext();
    }),
  );

  return analysis;
}
