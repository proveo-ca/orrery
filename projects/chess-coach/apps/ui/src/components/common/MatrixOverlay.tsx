import { createMemo } from "solid-js";
import { For } from "solid-js";
import { isMobileDevice } from "~/services/runtimeMode";
import styles from "~/components/common/MatrixOverlay.module.css";

interface MatrixOverlayProps {
  density?: number;
  speed?: number;
  maxDrops?: number;
  color?: string;
  class?: string;
}

interface Drop {
  id: number;
  left: string;
  fontSize: string;
  duration: string;
  delay: string;
  chars: string;
  color: string;
}

const rand = (min: number, max: number) => Math.random() * (max - min) + min;

const makeDrop = (id: number, color: string, speed: number): Drop => {
  const height = Math.floor(rand(14, 36));
  const chars = Array.from({ length: height }, () =>
    Math.random() > 0.5 ? "1" : "0",
  ).join("\n");
  const duration = (rand(2.4, 5.5) / speed).toFixed(2) + "s";
  const delay = (-rand(0, 4)).toFixed(2) + "s";
  return {
    id,
    left: rand(0, 98).toFixed(2) + "vw",
    fontSize: (15 + rand(0, 8)).toFixed(1) + "px",
    duration,
    delay,
    chars,
    color,
  };
};

export const MatrixOverlay = (props: MatrixOverlayProps) => {
  const isMobile = isMobileDevice();
  const density = Math.floor((props.density ?? 60) * (isMobile ? 0.33 : 1));
  const baseSpeed = (props.speed ?? 1) * (isMobile ? 0.5 : 1);
  const max = Math.floor((props.maxDrops ?? 240) * (isMobile ? 0.5 : 1));
  const count = Math.min(density, max);
  const color = props.color ?? "var(--matrix-color)";

  const drops = createMemo<Drop[]>(() =>
    Array.from({ length: count }, (_, i) => makeDrop(i, color, baseSpeed)),
  );

  return (
    <div class={`${styles.matrix} ${props.class || ""}`}>
      <For each={drops()}>
        {(d) => (
          <div
            class={styles.drop}
            style={{
              left: d.left,
              "font-size": d.fontSize,
              "--drop-color": d.color,
              "animation-duration": d.duration,
              "animation-delay": d.delay,
            }}
          >
            {d.chars}
          </div>
        )}
      </For>
    </div>
  );
};
