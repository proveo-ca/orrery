import { createSignal } from "solid-js";

export type EvalScore = { kind: "cp" | "mate"; value: number };

export const [baseEvalScore, setBaseEvalScore] = createSignal<EvalScore | null>(null);

/** Reached Stockfish search depth of the current best-move analysis (the green
 *  / blue board arrows). 0 when no analysis is running. */
export const [baseEvalDepth, setBaseEvalDepth] = createSignal<number>(0);
