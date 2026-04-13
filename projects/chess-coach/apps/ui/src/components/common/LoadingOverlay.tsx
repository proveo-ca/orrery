import clsx from "clsx";
import { type Component, createEffect, createSignal, Show } from "solid-js";

import { CoachAvatar, avatarStyles } from "~/components/CoachAvatar";
import { ProgressBar } from "~/components/common/ProgressBar";
import styles from "~/components/common/SplashScreen.module.css";
import { isAppReady, llmLoadingText, llmProgress } from "~/store/coachStore";

export const LoadingOverlay: Component = () => {
  const [mounted, setMounted] = createSignal(true);

  createEffect(() => {
    if (isAppReady()) {
      setTimeout(() => setMounted(false), 500);
    }
  });

  return (
    <Show when={mounted()}>
      <div
        class={styles["splash-screen"]}
        style={{
          opacity: isAppReady() ? 0 : 1,
          "pointer-events": isAppReady() ? "none" : "all",
          transition: "opacity 0.5s ease-in-out",
        }}
      >
        <div class={styles["splash-content"]}>
          <div class={styles["splash-avatar-wrapper"]}>
            <div class={clsx(avatarStyles.cat, avatarStyles.sleeping)}>
              <CoachAvatar />
            </div>
          </div>
          <h2 class={styles["splash-title"]}>Coach Selena is sleeping...</h2>
          <ProgressBar progress={llmProgress()} text={llmLoadingText()} />
        </div>
      </div>
    </Show>
  );
};
