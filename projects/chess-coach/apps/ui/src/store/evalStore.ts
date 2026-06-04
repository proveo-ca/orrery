import { createSignal } from "solid-js";

export type EvalScore = { kind: "cp" | "mate"; value: number };

export const [baseEvalScore, setBaseEvalScore] = createSignal<EvalScore | null>(null);
