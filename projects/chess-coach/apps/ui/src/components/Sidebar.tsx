import { Show } from "solid-js";
import type { Component } from "solid-js";

import { Modal } from "~/components/common/Modal";
import { Credits } from "~/components/Credits";
import { DualNavButton } from "~/components/DualNavButton";
import {
  CheckIcon,
  CogIcon,
  HintIcon,
  PlusCircleIcon,
  StarIcon,
} from "~/components/icons";
import { NewGamePanel } from "~/components/NewGamePanel";
import { Settings } from "~/components/Settings";
import styles from "~/components/Sidebar.module.css";
import { useGameControls } from "~/hooks/useGameControls";
import {
  setShowCredits,
  setShowNewGame,
  setShowSettings,
  showCredits,
  showNewGame,
  showSettings,
} from "~/store/coachStore";
import { isTravelling, travelFenHistory, travelIndex } from "~/store/travelStore.ts";

export const Sidebar: Component = () => {
  const controls = useGameControls();
  const {
    atStart,
    atLatest,
    isReplaying,
    pendingHint,
    handleBack,
    handleForward,
    handleBackToLive,
    handleHint,
  } = controls;

  return (
    <div class={styles.sidebar}>
      <DualNavButton
        onBack={handleBack}
        onForward={handleForward}
        backDisabled={atStart() && !isTravelling()}
        forwardDisabled={atLatest()}
        inverted={isTravelling() || isReplaying()}
      />

      <Show when={isTravelling() || isReplaying()}>
        <div class={styles["travel-section"]}>
          <Show when={isTravelling()}>
            <span class={styles["move-counter"]}>
              {travelIndex()}/{travelFenHistory().length - 1}
            </span>
          </Show>
          <button class={styles["icon-btn"]} onClick={handleBackToLive} aria-label="Back to live">
            <CheckIcon />
          </button>
        </div>
      </Show>

      <div class={styles.divider} />

      <button
        class={styles["icon-btn"]}
        onClick={handleHint}
        disabled={pendingHint() || isReplaying() || isTravelling()}
        aria-label="Get a hint"
      >
        <HintIcon />
      </button>

      <button class={styles["icon-btn"]} onClick={() => setShowNewGame(true)} aria-label="New game">
        <PlusCircleIcon />
      </button>

      <button
        class={styles["icon-btn"]}
        onClick={() => setShowCredits(true)}
        disabled={isReplaying() || isTravelling()}
        aria-label="Credits"
      >
        <StarIcon />
      </button>

      <button
        class={styles["icon-btn"]}
        onClick={() => setShowSettings(true)}
        disabled={isReplaying() || isTravelling()}
        aria-label="Settings"
      >
        <CogIcon />
      </button>

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
