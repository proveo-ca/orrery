import { Show, createMemo } from "solid-js";
import type { Component } from "solid-js";

import styles from "~/components/atoms/TurnLabel.module.css";
import { Label } from "~/components/primitives/Label";
import { currentFen, currentIndex, fenHistory } from "~/store/gameStore";
import { isTravelling } from "~/store/travelStore";

export const TurnLabel: Component = () => {
  const isReplaying = () => currentIndex() < fenHistory().length - 1;

  const memoizedLabel = createMemo(() => {
    const parts = currentFen().split(" ");
    const activeColor = parts[1] || "w";
    const fullmove = Number(parts[5] || "?");
    return `Move ${fullmove}${activeColor === "b" ? "..." : "."}`;
  });

  return (
    <Show when={!isTravelling() && isReplaying()}>
      <Label class={styles["turn-label"]}>{memoizedLabel()}</Label>
    </Show>
  );
};
