// SPEC: _spec/chess-coach/ui/components.puml
import clsx from "clsx";
import type { Component } from "solid-js";

import styles from "~/components/CoachAvatar.module.css";
import { coachEmotion } from "~/store/coachStore";

export { styles as avatarStyles };

export const CoachAvatar: Component = () => {
  return (
    <div class={clsx(styles.cat, styles[coachEmotion()])}>
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
