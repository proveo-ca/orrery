// SPEC: _spec/chess-coach/ui/components.puml
import type { Component } from "solid-js";

import styles from "~/components/atoms/EngineDepth.module.css";
import { baseEvalDepth } from "~/store/evalStore";

/**
 * Centre slot for the Analysis / Review mobile sidebar: a circle showing the
 * live Stockfish search depth behind the on-board best-move (green) and advice
 * (blue) arrows. The ring is split green→blue to tie it to those arrows.
 */
export const EngineDepth: Component = () => (
  <span class={styles.depth} title="Stockfish search depth (analysis arrows)">
    <span class={styles.num}>{baseEvalDepth() || "–"}</span>
    <span class={styles.label}>depth</span>
  </span>
);
