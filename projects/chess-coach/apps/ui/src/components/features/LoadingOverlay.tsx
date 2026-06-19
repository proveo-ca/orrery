import { type Component, createEffect, createSignal, Show } from "solid-js";

import { CoachAvatar } from "~/components/atoms/CoachAvatar";
import { ProgressBar } from "~/components/primitives/ProgressBar";
import { SplashScreen } from "~/components/primitives/SplashScreen";
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
      <SplashScreen
        fullscreen
        avatar={<CoachAvatar sleeping />}
        title="Coach Selena is sleeping..."
        style={{
          opacity: isAppReady() ? 0 : 1,
          "pointer-events": isAppReady() ? "none" : "all",
          transition: "opacity 0.5s ease-in-out",
        }}
      >
        <ProgressBar progress={llmProgress()} text={llmLoadingText()} />
      </SplashScreen>
    </Show>
  );
};
