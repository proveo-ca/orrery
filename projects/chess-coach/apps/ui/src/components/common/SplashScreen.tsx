import clsx from "clsx";
import { type Component, createEffect, createSignal, Show } from "solid-js";

import { CoachAvatar, avatarStyles } from "~/components/CoachAvatar";
import { ProgressBar } from "~/components/common/ProgressBar";
import styles from "~/components/common/SplashScreen.module.css";
import { isAppReady, llmLoadingText, llmProgress } from "~/store/coachStore";

type Phase = "loading" | "menu" | "dismissed";

interface SplashScreenProps {
  onStart: () => void;
}

export const SplashScreen: Component<SplashScreenProps> = (props) => {
  const [phase, setPhase] = createSignal<Phase>("loading");
  const [mounted, setMounted] = createSignal(true);

  createEffect(() => {
    if (isAppReady() && phase() === "loading") {
      setPhase("menu");
    }
  });

  const handleSelect = () => {
    setPhase("dismissed");
    props.onStart();
    setTimeout(() => setMounted(false), 500);
  };

  return (
    <Show when={mounted()}>
      <div
        class={styles["splash-screen"]}
        style={{
          opacity: phase() === "dismissed" ? 0 : 1,
          "pointer-events": phase() === "dismissed" ? "none" : "all",
          transition: "opacity 0.5s ease-in-out",
        }}
      >
        <div class={styles["splash-content"]}>
          <div class={styles["splash-avatar-wrapper"]}>
            <Show when={phase() === "loading"} fallback={<CoachAvatar />}>
              <div class={clsx(avatarStyles.cat, avatarStyles.sleeping)}>
                <CoachAvatar />
              </div>
            </Show>
          </div>

          <Show when={phase() === "loading"}>
            <h2 class={styles["splash-title"]}>Coach Selena is sleeping...</h2>
            <ProgressBar progress={llmProgress()} text={llmLoadingText()} />
          </Show>

          <Show when={phase() === "menu"}>
            <h2 class={styles["splash-title"]}>What shall we do?</h2>
            <div class={styles["menu-options"]}>
              <button
                class={clsx(styles["menu-btn"], styles["menu-btn--primary"])}
                onClick={handleSelect}
              >
                Play with Selena
              </button>
              <button class={styles["menu-btn"]} onClick={handleSelect}>
                Solo Analysis
              </button>
              <button class={styles["menu-btn"]} disabled>
                Play LAN
              </button>
              <span class={styles["coming-soon"]}>Coming soon!</span>
            </div>
          </Show>
        </div>
      </div>
    </Show>
  );
};
