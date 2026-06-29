// SPEC: _spec/chess-coach/ui/components.puml
import { Show, createEffect, createSignal, onCleanup } from "solid-js";
import type { Component } from "solid-js";

import styles from "~/components/atoms/Clock.module.css";
import { game } from "~/store/gameStore";
import { clocks, gameOver, started, timeControl } from "~/store/roomStore";
import type { Clocks } from "~/types/multiplayer";

interface ClockProps {
  color: "w" | "b";
}

const fmt = (ms: number): string => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

/**
 * One player's chess clock. Reads the host-authoritative remaining time from
 * roomStore and ticks the running colour down locally between updates; renders
 * nothing in an untimed room. Lit while it's this colour's turn.
 */
export const Clock: Component<ClockProps> = (props) => {
  const [now, setNow] = createSignal(Date.now());
  const [base, setBase] = createSignal<{ clocks: Clocks | null; at: number }>({
    clocks: clocks(),
    at: Date.now(),
  });

  // Re-baseline whenever the authoritative clocks change (every move / resync).
  createEffect(() => {
    setBase({ clocks: clocks(), at: Date.now() });
  });

  // Tick a display signal only while a timed game is running.
  createEffect(() => {
    if (!started() || gameOver() || timeControl() == null) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    onCleanup(() => clearInterval(id));
  });

  const isActive = () => started() && !gameOver() && game().turn() === props.color;
  const remaining = () => {
    const b = base();
    if (!b.clocks) return 0;
    const ms = isActive() ? b.clocks[props.color] - (now() - b.at) : b.clocks[props.color];
    return Math.max(0, ms);
  };

  return (
    <Show when={timeControl() != null}>
      <span
        class={styles.clock}
        classList={{
          [styles.white]: props.color === "w",
          [styles.black]: props.color === "b",
          [styles.active]: isActive(),
        }}
        data-testid={`clock-${props.color}`}
      >
        {fmt(remaining())}
      </span>
    </Show>
  );
};
