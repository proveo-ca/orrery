import { onMount, onCleanup } from "solid-js";
import { isMobileDevice } from "~/services/runtimeMode";
import styles from "~/components/common/MatrixOverlay.module.css";

interface MatrixOverlayProps {
  density?: number;
  speed?: number;
  maxDrops?: number;
  color?: string;
  class?: string;
}

export const MatrixOverlay = (props: MatrixOverlayProps) => {
  let containerRef: HTMLDivElement | undefined;
  let intervalId: number | undefined;

  const density = () => Math.floor((props.density ?? 80));
  const baseSpeed = () => props.speed ?? 1
  const maxDrops = () => Math.floor((props.maxDrops ?? 160) * (isMobileDevice() ? 0.66 : 1));
  const color = () => props.color ?? "var(--matrix-color)";

  const createDrop = () => {
    if (!containerRef || containerRef.childElementCount >= maxDrops()) return;

    const drop = document.createElement("div");
    drop.className = styles.drop;

    const height = Math.floor(Math.random() * 22) + 14;

    for (let i = 0; i < height; i++) {
      const span = document.createElement("span");
      span.textContent = Math.random() > 0.5 ? "1" : "0";

      const delay = i * 0.028 + Math.random() * 0.18;
      span.style.animationDelay = `${delay}s`;
      span.style.opacity = String(0.55 + Math.random() * 0.45);

      drop.appendChild(span);
    }

    // Positioning & styling
    drop.style.left = `${Math.random() * 98}vw`;
    drop.style.fontSize = `${15 + Math.random() * 8}px`;
    drop.style.setProperty("--drop-color", color());

    const duration = (2.4 + Math.random() * 3.1) / baseSpeed();
    drop.style.animationDuration = `${duration}s`;
    drop.style.animationDelay = `-${Math.random() * 4}s`;

    containerRef.appendChild(drop);

    // Auto cleanup
    setTimeout(() => drop.remove(), (duration + 6) * 1000);
  };

  onMount(() => {
    // Initial burst
    for (let i = 0; i < density(); i++) {
      setTimeout(createDrop, i * 12);
    }

    // Continuous rain
    intervalId = window.setInterval(createDrop, 38);
  });

  onCleanup(() => {
    if (intervalId) {
      window.clearInterval(intervalId);
    }
  });

  return (
    <div
      ref={containerRef}
      class={`${styles.matrix} ${props.class || ""}`}
    />
  );
}
