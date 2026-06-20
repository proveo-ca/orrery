import { createMemo } from "solid-js";
import type { Component } from "solid-js";

import styles from "~/components/atoms/ChessBoardArrow.module.css";
import { activePlayerColor } from "~/store/settingsStore";

const squareCenter = (square: string, flipped: boolean): { cx: number; cy: number } => {
  const fileIdx = square.charCodeAt(0) - 97;
  const rankIdx = 8 - Number(square[1]);
  const col = flipped ? 7 - fileIdx : fileIdx;
  const row = flipped ? 7 - rankIdx : rankIdx;
  return { cx: col + 0.5, cy: row + 0.5 };
};

interface BoardArrowProps {
  from: string;
  to: string;
  color: string;
  id: string;
}

export const ChessBoardArrow: Component<BoardArrowProps> = (props) => {
  const from = createMemo(() => squareCenter(props.from, activePlayerColor() === "b"));
  const to = createMemo(() => squareCenter(props.to, activePlayerColor() === "b"));

  return (
    <svg class={styles["best-move-arrow"]} viewBox="0 0 8 8" preserveAspectRatio="none">
      <defs>
        <marker
          id={props.id}
          viewBox="0 0 4 4"
          refX="3"
          refY="2"
          markerWidth="0.5"
          markerHeight="0.5"
          markerUnits="userSpaceOnUse"
          orient="auto"
        >
          <path d="M 0 0 L 4 2 L 0 4 z" fill={props.color} />
        </marker>
      </defs>
      <line
        x1={from().cx}
        y1={from().cy}
        x2={to().cx}
        y2={to().cy}
        stroke={props.color}
        stroke-width="0.18"
        stroke-linecap="round"
        marker-end={`url(#${props.id})`}
        opacity="0.85"
      />
    </svg>
  );
};
