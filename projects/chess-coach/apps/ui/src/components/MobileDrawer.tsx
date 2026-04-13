import { useNavigate } from "@solidjs/router";
import clsx from "clsx";
import { Show, createSignal } from "solid-js";
import type { Component } from "solid-js";

import { Modal } from "~/components/common/Modal";
import { Credits } from "~/components/Credits";
import { DualNavButton } from "~/components/DualNavButton";
import {
  CheckIcon,
  HamburgerIcon,
  HintIcon,
  PlusCircleIcon,
  StarIcon,
} from "~/components/icons";
import styles from "~/components/MobileDrawer.module.css";
import { NewGamePanel } from "~/components/NewGamePanel";
import { SettingsPanel } from "~/components/Settings";
import { useGameControls } from "~/hooks/useGameControls";
import { capabilities } from "~/store/capabilitiesStore";
import {
  setShowCredits,
  setShowNewGame,
  showCredits,
  showNewGame,
} from "~/store/coachStore";
import { isTravelling, travelFenHistory, travelIndex } from "~/store/travelStore.ts";

export const MobileDrawer: Component = () => {
  const navigate = useNavigate();
  const [open, setOpen] = createSignal(false);
  const controls = useGameControls();
  const {
    atStart,
    atLatest,
    isReplaying,
    pendingHint,
    handleBack,
    handleForward,
    handleBackToLive,
    handleHint: baseHandleHint,
    handleNewGame: baseHandleNewGame,
  } = controls;

  const handleHint = () => {
    setOpen(false);
    baseHandleHint();
  };

  const handleNewGame = () => {
    setOpen(false);
    baseHandleNewGame();
  };

  return (
    <div class={styles["mobile-only"]}>
      <button class={styles["hamburger-btn"]} onClick={() => setOpen(true)} aria-label="Open menu">
        <HamburgerIcon />
      </button>

      <div class={styles["top-right-nav"]}>
        <DualNavButton
          onBack={handleBack}
          onForward={handleForward}
          backDisabled={atStart() && !isTravelling()}
          forwardDisabled={atLatest()}
          inverted={isTravelling() || isReplaying()}
        />

        <Show when={isTravelling()}>
          <span class={styles["travel-info"]}>
            {travelIndex()}/{travelFenHistory().length - 1}
          </span>
        </Show>

        <Show when={isTravelling() || isReplaying()}>
          <button class={styles["icon-btn"]} onClick={handleBackToLive} aria-label="Back to live">
            <CheckIcon />
          </button>
        </Show>
      </div>

      <div
        class={clsx(styles.backdrop, open() && styles["backdrop--open"])}
        onClick={() => setOpen(false)}
      />

      <div class={clsx(styles.drawer, open() && styles["drawer--open"])}>
        <p class={styles["section-title"]}>Menu</p>
        <div class={styles["menu-list"]}>
          <button
            class={styles["menu-btn"]}
            onClick={() => {
              setOpen(false);
              navigate("/selena");
            }}
          >
            Play with Selena
          </button>
          <button
            class={styles["menu-btn"]}
            onClick={() => {
              setOpen(false);
              navigate("/analysis");
            }}
          >
            Solo Analysis
          </button>
          <button class={styles["menu-btn"]} disabled>
            Play LAN
          </button>
          <span class={styles["coming-soon"]}>Coming soon!</span>
        </div>

        <div class={styles.divider} />

        <p class={styles["section-title"]}>Controls</p>
        <div class={styles["controls-row"]}>
          <Show when={capabilities().hint}>
            <button
              class={styles["icon-btn"]}
              onClick={handleHint}
              disabled={pendingHint() || isReplaying() || isTravelling()}
              aria-label="Get a hint"
            >
              <HintIcon />
            </button>
          </Show>

          <button class={styles["icon-btn"]} onClick={handleNewGame} aria-label="New game">
            <PlusCircleIcon />
          </button>

          <button
            class={styles["icon-btn"]}
            onClick={() => {
              setOpen(false);
              setShowCredits(true);
            }}
            disabled={isReplaying() || isTravelling()}
            aria-label="Credits"
          >
            <StarIcon />
          </button>
        </div>

        <div class={styles.divider} />

        <p class={styles["section-title"]}>Settings</p>
        <SettingsPanel onDismiss={() => setOpen(false)} />
      </div>

      <Modal
        open={showNewGame()}
        onClose={() => setShowNewGame(false)}
        title="New Game"
        position="fixed"
      >
        <NewGamePanel />
      </Modal>

      <Credits open={showCredits()} onClose={() => setShowCredits(false)} />
    </div>
  );
};
