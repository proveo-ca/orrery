// SPEC: _spec/chess-coach/ui/components.puml
import clsx from "clsx";
import type { Component } from "solid-js";

import styles from "~/components/atoms/CoachAvatar.module.css";
import { coachEmotion } from "~/store/coachStore";

interface CoachAvatarProps {
  /** Force the sleeping pose, ignoring the live coach emotion (used by the loading splash). */
  sleeping?: boolean;
  /** Bar-sized variant (used as the MobileSidebar centre slot). */
  compact?: boolean;
}

export const CoachAvatar: Component<CoachAvatarProps> = (props) => {
  return (
    <div
      class={clsx(
        styles.cat,
        props.compact && styles.compact,
        props.sleeping ? styles.sleeping : styles[coachEmotion()],
      )}
    >
      <div class={clsx(styles.ear, styles["ear--left"])}></div>
      <div class={clsx(styles.ear, styles["ear--right"])}></div>
      <div class={styles.face}>
        <div class={clsx(styles.eye, styles["eye--left"])}>
          <div class={styles["eye-pupil"]}></div>
        </div>
        <div class={clsx(styles.eye, styles["eye--right"])}>
          <div class={styles["eye-pupil"]}></div>
        </div>
        <div class={styles.muzzle}></div>
      </div>
      <div class={styles["zzz-container"]}>
        <div class={clsx(styles.z, styles["z-1"])}>Z</div>
        <div class={clsx(styles.z, styles["z-2"])}>Z</div>
        <div class={clsx(styles.z, styles["z-3"])}>Z</div>
      </div>
    </div>
  );
};
