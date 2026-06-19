import { createSignal, onMount } from "solid-js";

import styles from "~/components/atoms/LightSpeedOverlay.module.css";

interface LightSpeedOverlayProps {
  active: boolean;
  beamCount?: number; // default: 20
  baseDuration?: number; // default: 1 (seconds)
  maxDelay?: number; // default: 0.4
  durationVariance?: number; // default: 0.15
}

export const LightSpeedOverlay = (props: LightSpeedOverlayProps) => {
  const beamCount = props.beamCount ?? 20;
  const baseDuration = props.baseDuration ?? 1;
  const maxDelay = props.maxDelay ?? 0.4;
  const durationVariance = props.durationVariance ?? 0.15;

  const [beams, setBeams] = createSignal<Array<{ rot: number; delay: number; duration: number }>>(
    [],
  );

  onMount(() => {
    const newBeams = [];

    for (let i = 0; i < beamCount; i++) {
      const rot = (360 / beamCount) * i;
      const delay = Math.random() * maxDelay;
      const duration = baseDuration + (Math.random() * 2 - 1) * durationVariance;

      newBeams.push({ rot, delay, duration });
    }

    setBeams(newBeams);
  });

  return (
    <div class={styles["lightspeed-overlay"]} classList={{ [styles.active]: props.active }}>
      <div class={styles["center-glow"]} />
      <div class={styles["beams-container"]}>
        {beams().map((beam) => (
          <div
            class={styles.beam}
            style={{
              "--rot": `${beam.rot}deg`,
              "--delay": `${beam.delay}s`,
              "--duration": `${beam.duration}s`,
            }}
          />
        ))}
      </div>
    </div>
  );
};
