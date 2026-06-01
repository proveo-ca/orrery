// SPEC: _spec/chess-coach/ui/components.puml
import { Show, createSignal } from "solid-js";
import type { Component } from "solid-js";

import { Button } from "~/components/common/Button";
import { CogIcon } from "~/components/common/icons";
import { Label } from "~/components/common/Label";
import styles from "~/components/Controls.module.css";
import { Credits } from "~/components/Credits";
import { Settings } from "~/components/Settings";
import { TurnLabel } from "~/components/TurnLabel";
import { useGameControls } from "~/hooks/useGameControls";
import { capabilities } from "~/store/capabilitiesStore";
import { reviewAnalysisMode } from "~/store/gameStore";
import { isTravelling, travelFenHistory, travelIndex } from "~/store/travelStore";

export const BoardActions: Component = () => {
  const [showCredits, setShowCredits] = createSignal(false);
  const [showSettings, setShowSettings] = createSignal(false);
  const {
    atStart,
    atLatest,
    isReplaying,
    pendingHint,
    handleBack,
    handleForward,
    handleBackToLive,
    handleHint,
  } = useGameControls();

  return (
    <div class={styles["board-actions"]}>
      <div class={styles["nav-row"]}>
        <Button onClick={handleBack} disabled={atStart() && !isTravelling()}>
          &larr;
        </Button>
        <Button onClick={handleForward} disabled={atLatest()}>
          &rarr;
        </Button>
      </div>

      {(isTravelling() || isReplaying() || reviewAnalysisMode()) && (
        <div class={styles["travel-row"]}>
          {isTravelling() && (
            <Label>
              Move {travelIndex()}/{travelFenHistory().length - 1}
            </Label>
          )}
          {isReplaying() && <TurnLabel />}
          <Button class={styles["back-to-live"]} onClick={handleBackToLive}>
            Back to Live
          </Button>
        </div>
      )}

      <div class={styles["nav-row"]}>
        <Show when={capabilities().hint}>
          <Button onClick={handleHint} disabled={pendingHint() || isReplaying() || isTravelling()}>
            {pendingHint() ? "Thinking..." : "Hint"}
          </Button>
        </Show>
        <Button onClick={() => setShowCredits(true)} disabled={isReplaying() || isTravelling()}>
          Credits
        </Button>

        <Button
          onClick={() => setShowSettings(true)}
          disabled={isReplaying() || isTravelling()}
          class={styles["settings-btn"]}
          aria-label="Settings"
        >
          <CogIcon />
          <span class={styles["settings-btn-label"]}>Settings</span>
        </Button>

        <Credits open={showCredits()} onClose={() => setShowCredits(false)} />
        <Settings open={showSettings()} onClose={() => setShowSettings(false)} />
      </div>
    </div>
  );
};
