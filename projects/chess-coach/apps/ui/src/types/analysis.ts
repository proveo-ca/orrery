import type { MoveRecord } from "~/types/game";

export type AnnotationTag = "best" | "blunder" | "inaccuracy" | "hint" | "forced";

export type PositionEval = { kind: "cp" | "mate"; value: number };

export type EvalResult = { bestMove: string | null; score: PositionEval | null; depth: number };

export type MoveRow = {
  turn: number;
  white: MoveRecord | null;
  whiteIndex: number;
  black: MoveRecord | null;
  blackIndex: number;
};

export type GameAnalysis = {
  cpDeltas: (number | null)[];
  wasBestMoves: boolean[];
  bestMoveUcis: (string | null)[];
  loading: boolean;
};
