// SPEC: _spec/chess-coach/ui/components.puml
import { type Component } from "solid-js";

import styles from "~/components/EvalBar.module.css";

interface EvalBarProps {
  score?: { kind: "cp" | "mate"; value: number } | null;
  isFlipped?: boolean;
  maxPawns?: number;
  turn?: "w" | "b";
}

export const EvalBar: Component<EvalBarProps> = (props) => {
  const maxPawns = () => props.maxPawns ?? 10;

  // Convert relative score (side to move) to absolute score (White's perspective)
  const absoluteValue = () => {
    if (!props.score) return 0;
    let val = props.score.value;
    if (props.turn === "b") val = -val;
    return val;
  };

  // Player perspective value: flip sign when player is Black (isFlipped)
  const playerValue = () => {
    const v = absoluteValue();
    return props.isFlipped ? -v : v;
  };

  const numericValue = () => {
    if (!props.score) return 0;
    const val = absoluteValue();
    if (props.score.kind === "mate") return val > 0 ? 100 : -100;
    return val / 100; // cp to pawns
  };

  // Normalize input: -maxPawns → +maxPawns becomes -1 → +1
  // If flipped (Black at bottom), we negate it so positive norm = bottom player winning
  const normalized = () => {
    let norm = Math.max(-1, Math.min(1, numericValue() / maxPawns()));
    if (props.isFlipped) norm = -norm;
    return norm;
  };

  const bottomScale = () => Math.max(0, Math.min(1, 0.5 + normalized() * 0.5));
  const topScale = () => 1 - bottomScale();

  const topColorClass = () => (props.isFlipped ? styles["eval-white"] : styles["eval-black"]);
  const bottomColorClass = () => (props.isFlipped ? styles["eval-black"] : styles["eval-white"]);

  const displayValue = () => {
    if (!props.score) return "0.0";
    const val = playerValue();
    if (props.score.kind === "mate") return val > 0 ? `+M${val}` : `-M${Math.abs(val)}`;
    const v = val / 100;
    return v > 0 ? `+${v.toFixed(1)}` : v.toFixed(1);
  };

  const valueColor = () => {
    const v = playerValue() / 100; // in pawns from player perspective
    if (Math.abs(v) >= 9) return v > 0 ? "#ffeb3b" : "#64b5f6";
    return "#ffffff";
  };

  return (
    <div class={styles["eval-bar"]}>
      <div
        class={topColorClass()}
        style={{ transform: `scaleY(${topScale()})` }}
      />
      <div
        class={bottomColorClass()}
        style={{ transform: `scaleY(${bottomScale()})` }}
      />
      <div class={styles["eval-value"]} style={{ color: valueColor() }}>
        {displayValue()}
      </div>
    </div>
  );
};
