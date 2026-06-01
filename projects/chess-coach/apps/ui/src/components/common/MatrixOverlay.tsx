import { onMount, onCleanup } from "solid-js";
import styles from "~/components/common/MatrixOverlay.module.css";

interface MatrixOverlayProps {
  density?: number;        // Recommended: 60-110
  speed?: number;          // 0.8 = slower, 1.5 = faster
  opacity?: number;        // 0.4 - 0.9
  color?: string;
  class?: string;
}

export const MatrixOverlay = (props: MatrixOverlayProps) => {
  let containerRef: HTMLDivElement | undefined;
  let intervalId: number | undefined;

  const density = () => props.density ?? 80;
  const baseSpeed = () => props.speed ?? 1;
  const opacity = () => props.opacity ?? 0.7;
  const color = () => props.color ?? "var(--matrix-color)";

  const createDrop = () => {
    if (!containerRef) return;

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
    drop.style.opacity = String(opacity());

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
