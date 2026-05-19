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
  } catch {}
}

export function deleteAnalysisCache(gameId: string): void {
  try {
    localStorage.removeItem(CACHE_PREFIX + gameId);
  } catch {}
}

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

function buildFenList(game: GameRecord) {
  const chess = new Chess(game.startingFen);
  const fens = [chess.fen()];
  const playedUcis: string[] = [];
  for (const m of game.moves) {
    try {
      const result = chess.move(m.san);
      fens.push(chess.fen());
      playedUcis.push(result ? `${result.from}${result.to}${result.promotion ?? ""}` : "");
    } catch {
      fens.push(fens[fens.length - 1]);
      playedUcis.push("");
    }
  }
  return { fens, playedUcis };
}

function seedFromCache(cached: CachedAnalysis | null, len: number) {
  const evals: (PositionEval | null)[] =
    cached && cached.evals.length === len
      ? [...cached.evals]
      : Array.from({ length: len }, () => null);
  const bestMoveUcis: (string | null)[] =
    cached && cached.bestMoveUcis.length === len
      ? [...cached.bestMoveUcis]
      : Array.from({ length: len }, () => null);
  let startPos = evals.findIndex((e) => e === null);
  if (startPos < 0) startPos = len;
  return { evals, bestMoveUcis, startPos };
}

function runParallelAnalysis(
  fens: string[],
  evals: (PositionEval | null)[],
  bestMoveUcis: (string | null)[],
  startPos: number,
  isAborted: () => boolean,
  onProgress: (final: boolean) => void,
  onDone: () => void,
) {
  const remaining = fens.length - startPos;
  if (remaining <= 0) {
    onDone();
    return;
  }

  const mid = startPos + Math.ceil(remaining / 2);
  const ranges = [
    { start: startPos, end: mid },
    { start: mid, end: fens.length },
  ];

  let finished = 0;

  for (let w = 0; w < 2; w++) {
    const { start, end } = ranges[w];
    if (start >= end) {
      finished++;
      continue;
    }

    const worker = new Worker(DEFAULT_STOCKFISH_WORKER_URL);
    worker.postMessage("uci");
    worker.postMessage("isready");

    let current = start;
    let latestScore: PositionEval | null = null;

    const evalNext = () => {
      if (current >= end) {
        finished++;
        worker.terminate();
        if (finished === 2) onDone();
        return;
      }
      latestScore = null;
      worker.postMessage("ucinewgame");
      worker.postMessage(`position fen ${fens[current]}`);
      worker.postMessage("go depth 20");
    };

    worker.onmessage = (event: MessageEvent) => {
      if (isAborted()) return;

      const raw = event.data;
      if (typeof raw !== "string") return;

      const msg = parseStockfishMessage(raw);

      if (msg.type === "info" && msg.score) {
        latestScore = msg.score;
        return;
      }

      if (msg.type === "bestmove") {
        evals[current] = latestScore;
        const uci = msg.move && msg.move !== "(none)" ? msg.move : null;
        bestMoveUcis[current] = uci;
        current++;

        if (current % 4 === 0 || current >= end) {
          onProgress(current >= fens.length);
        }
        evalNext();
      }
    };

    evalNext();
  }
}

export function useGameAnalysis(game: () => GameRecord | null) {
  const [analysis, setAnalysis] = createSignal<GameAnalysis>(EMPTY);

  let _aborted = false;

  const cleanup = () => {
    _aborted = true;
  };

  onCleanup(cleanup);

  const flush = (gameId: string, evals: (PositionEval | null)[], bestMoveUcis: (string | null)[], final: boolean) => {
    if (_aborted) return;

    const g = game();
    if (!g) return;
    const derived = deriveAnalysis(g.moves, evals, bestMoveUcis, buildFenList(g).playedUcis);
    setAnalysis({ ...derived, loading: !final });
    writeCache(gameId, { evals: [...evals], bestMoveUcis: [...bestMoveUcis], complete: final });
  };

  createEffect(
    on(game, (g) => {
      cleanup();
      if (!g || g.moves.length === 0) {
        setAnalysis(EMPTY);
        return;
      }

      _aborted = false;
      const { fens, playedUcis } = buildFenList(g);
      const cached = readCache(g.id);

      if (cached && cached.complete && cached.evals.length === fens.length) {
        const derived = deriveAnalysis(g.moves, cached.evals, cached.bestMoveUcis, playedUcis);
        setAnalysis({ ...derived, loading: false });
        return;
      }

      const { evals, bestMoveUcis, startPos } = seedFromCache(cached, fens.length);
      const initial = deriveAnalysis(g.moves, evals, bestMoveUcis, playedUcis);
      setAnalysis({ ...initial, loading: true });

      runParallelAnalysis(
        fens,
        evals,
        bestMoveUcis,
        startPos,
        () => _aborted,
        (final) => flush(g.id, evals, bestMoveUcis, final),
        () => flush(g.id, evals, bestMoveUcis, true),
      );
    }),
  );

  return analysis;
}
