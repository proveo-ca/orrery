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
  /** True while any positions are still being evaluated. */
  loading: boolean;
};

const EMPTY: GameAnalysis = { cpDeltas: [], wasBestMoves: [], loading: false };

/**
 * Batch-evaluate every position in a saved game via a dedicated Stockfish
 * worker. Runs at review time — no data is stored; results live in a
 * reactive signal that updates as each position completes.
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
      setAnalysis({ cpDeltas: g.moves.map(() => null), wasBestMoves: g.moves.map(() => false), loading: true });

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

      // Evaluate each position sequentially via a dedicated worker.
      worker = new Worker(DEFAULT_STOCKFISH_WORKER_URL);
      worker.postMessage("uci");
      worker.postMessage("isready");

      const evals: (PositionEval | null)[] = Array.from({ length: fens.length }, () => null);
      const bestMoveUcis: (string | null)[] = Array.from({ length: fens.length }, () => null);
      let currentPos = 0;
      let latestScore: PositionEval | null = null;

      const evalNext = () => {
        if (aborted || !worker || currentPos >= fens.length) {
          if (!aborted) flush();
          return;
        }
        latestScore = null;
        worker.postMessage("ucinewgame");
        worker.postMessage(`position fen ${fens[currentPos]}`);
        worker.postMessage("go depth 20");
      };

      const scoreToCp = (s: PositionEval): number =>
        s.kind === "mate" ? (s.value > 0 ? 10000 : -10000) : s.value;

      const flush = () => {
        const cpDeltas: (number | null)[] = [];
        const wasBestMoves: boolean[] = [];

        for (let i = 0; i < g.moves.length; i++) {
          const before = evals[i];
          const after = evals[i + 1];
          if (before && after) {
            // before is from side-to-move's POV (the player about to move).
            // after is from the OTHER side's POV. Negate to get same-side.
            cpDeltas.push(-scoreToCp(after) - scoreToCp(before));
          } else {
            cpDeltas.push(null);
          }
          const bestUci = bestMoveUcis[i];
          wasBestMoves.push(bestUci != null && playedUcis[i] === bestUci);
        }

        setAnalysis({ cpDeltas, wasBestMoves, loading: false });
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
          if (currentPos % 4 === 0 || currentPos >= fens.length) flush();

          evalNext();
        }
      };

      evalNext();
    }),
  );

  return analysis;
}
