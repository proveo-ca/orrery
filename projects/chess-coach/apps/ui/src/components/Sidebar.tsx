import { Show } from "solid-js";
import type { Component } from "solid-js";

import { Divider } from "~/components/common/Divider";
import { IconButton } from "~/components/common/IconButton";
import {
  CheckIcon,
  CogIcon,
  FlagIcon,
  HintIcon,
  PlusCircleIcon,
  StarIcon,
} from "~/components/common/icons";
import { Label } from "~/components/common/Label";
import { Modal } from "~/components/common/Modal";
import { Credits } from "~/components/Credits";
import { DualNavButton } from "~/components/DualNavButton";
import { NewGamePanel } from "~/components/NewGamePanel";
import { Settings } from "~/components/Settings";
import styles from "~/components/Sidebar.module.css";
import { useGameControls } from "~/hooks/useGameControls";
import { useHintSparkle } from "~/hooks/useHintSparkle";
import { capabilities } from "~/store/capabilitiesStore";
import {
  setShowCredits,
  setShowNewGame,
  setShowSettings,
  showCredits,
  showNewGame,
  showSettings,
} from "~/store/coachStore";
import { resetGame } from "~/store/gameStore";
import { isTravelling, travelFenHistory, travelIndex } from "~/store/travelStore.ts";

export const Sidebar: Component = () => {
  const { hintSparkleClass, dismissHintSparkle } = useHintSparkle();
  const controls = useGameControls();
  const {
    atStart,
    atLatest,
    isReplaying,
    isResigned,
    pendingHint,
    handleBack,
    handleForward,
    handleBackToLive,
    handleHint: baseHandleHint,
    handleResign,
  } = controls;

  const handleHint = () => {
    dismissHintSparkle();
    baseHandleHint();
  };

  return (
    <div class={styles.sidebar}>
      <DualNavButton
        onBack={handleBack}
        onForward={handleForward}
        backDisabled={atStart() && !isTravelling()}
        forwardDisabled={atLatest()}
        inverted={isTravelling() || isReplaying()}
        label={isTravelling() ? "Timeline" : isReplaying() ? "History" : undefined}
      />

      <Show when={isTravelling() || isReplaying()}>
        <div class={styles["travel-section"]}>
          <Show when={isTravelling()}>
            <Label variant="caption" class={styles["move-counter"]}>
              {travelIndex()}/{travelFenHistory().length - 1}
            </Label>
          </Show>
          <IconButton onClick={handleBackToLive} aria-label="Back to live">
            <CheckIcon />
          </IconButton>
        </div>
      </Show>

      <Divider class={styles.divider} />

      <Show when={capabilities().hint}>
        <IconButton
          label="Hint"
          class={hintSparkleClass()}
          onClick={handleHint}
          disabled={pendingHint() || isReplaying() || isTravelling()}
          aria-label="Get a hint"
        >
          <HintIcon />
        </IconButton>
      </Show>

      <Show when={capabilities().aiOpponent}>
        <IconButton
          label="Resign"
          onClick={handleResign}
          disabled={isReplaying() || isTravelling() || isResigned()}
          aria-label="Resign"
        >
          <FlagIcon />
        </IconButton>
      </Show>

      <Show when={!capabilities().aiOpponent && !capabilities().readOnly}>
        <IconButton label="New Game" onClick={() => resetGame()} aria-label="New game">
          <PlusCircleIcon />
        </IconButton>
      </Show>

      <IconButton
        label="Credits"
        onClick={() => setShowCredits(true)}
        disabled={isReplaying() || isTravelling()}
        aria-label="Credits"
      >
        <StarIcon />
      </IconButton>

      <IconButton
        label="Settings"
        onClick={() => setShowSettings(true)}
        disabled={isReplaying() || isTravelling()}
        aria-label="Settings"
      >
        <CogIcon />
      </IconButton>

      <Modal
        open={showNewGame()}
        onClose={() => setShowNewGame(false)}
        title="New Game"
        position="fixed"
      >
        <NewGamePanel />
      </Modal>

      <Credits open={showCredits()} onClose={() => setShowCredits(false)} />
      <Settings open={showSettings()} onClose={() => setShowSettings(false)} />
    </div>
  );
};
