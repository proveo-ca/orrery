import { type Component, createEffect, createSignal, Show } from "solid-js";

import { CoachAvatar } from "~/components/CoachAvatar";
import { ProgressBar } from "~/components/common/ProgressBar";
import { isAppReady, llmLoadingText, llmProgress } from "~/store/coachStore";
import "~/components/common/SplashScreen.css";

export const SplashScreen: Component = () => {
  const [mounted, setMounted] = createSignal(true);

  createEffect(() => {
    if (isAppReady()) {
      setTimeout(() => setMounted(false), 500);
    }
  });

  return (
    <Show when={mounted()}>
      <div
        class="splash-screen"
        style={{
          opacity: isAppReady() ? 0 : 1,
          "pointer-events": isAppReady() ? "none" : "all",
          transition: "opacity 0.5s ease-in-out",
        }}
      >
        <div class="splash-content">
          <div class="splash-avatar-wrapper">
            <div class="cat sleeping">
              <CoachAvatar />
            </div>
          </div>
          <h2 class="splash-title">Coach Selena is sleeping...</h2>

          <ProgressBar progress={llmProgress()} text={llmLoadingText()} />
        </div>
      </div>
    </Show>
  );
};
