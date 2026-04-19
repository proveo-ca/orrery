// SPEC: _spec/chess-coach/ui/components.puml
import clsx from "clsx";
import { Show, createSignal } from "solid-js";
import type { Component } from "solid-js";

import { Divider } from "~/components/common/Divider";
import { IconButton } from "~/components/common/IconButton";
import {
  CheckIcon,
  FlagIcon,
  FlipBoardIcon,
  HamburgerIcon,
  HintIcon,
  PlusCircleIcon,
  StarIcon,
} from "~/components/common/icons";
import { Label } from "~/components/common/Label";
import { MenuButton } from "~/components/common/MenuButton";
import { Modal } from "~/components/common/Modal";
import { Credits } from "~/components/Credits";
import { DualNavButton } from "~/components/DualNavButton";
import styles from "~/components/MobileDrawer.module.css";
import { NewGamePanel } from "~/components/NewGamePanel";
import { SettingsPanel } from "~/components/Settings";
import { useGameControls } from "~/hooks/useGameControls";
import { useHintSparkle } from "~/hooks/useHintSparkle";
import { capabilities } from "~/store/capabilitiesStore";
import { setShowCredits, setShowNewGame, showCredits, showNewGame } from "~/store/coachStore";
import { gameHistory } from "~/store/gameHistoryStore";
import { resetGame } from "~/store/gameStore";
import { activePlayerColor, setActivePlayerColor } from "~/store/settingsStore";
import { isTravelling, travelFenHistory, travelIndex } from "~/store/travelStore.ts";

export const MobileDrawer: Component = () => {
  const [open, setOpen] = createSignal(false);
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
    handleResign: baseHandleResign,
  } = controls;

  const handleHint = () => {
    dismissHintSparkle();
    setOpen(false);
    void baseHandleHint();
  };

  const handleResign = () => {
    setOpen(false);
    baseHandleResign();
  };

  return (
    <div class={styles["mobile-only"]}>
      <div class={styles["top-left-nav"]}>
        <IconButton
          class={styles.hamburger}
          label="Menu"
          labelPosition="bottom"
          onClick={() => setOpen(true)}
          aria-label="Open menu"
        >
          <HamburgerIcon />
        </IconButton>
        <Show when={capabilities().hint}>
          <IconButton
            label="Hint"
            labelPosition="bottom"
            class={hintSparkleClass()}
            onClick={handleHint}
            disabled={pendingHint() || isReplaying() || isTravelling()}
            aria-label="Get a hint"
          >
            <HintIcon />
          </IconButton>
        </Show>
        <Show when={!capabilities().aiOpponent && !capabilities().readOnly}>
          <IconButton
            label="New Game"
            labelPosition="bottom"
            onClick={() => resetGame()}
            aria-label="New game"
          >
            <PlusCircleIcon />
          </IconButton>
        </Show>
      </div>

      <Show when={capabilities().historyNav}>
        <div class={styles["top-right-nav"]}>
          <DualNavButton
            onBack={handleBack}
            onForward={handleForward}
            backDisabled={atStart() && !isTravelling()}
            forwardDisabled={atLatest()}
            inverted={isTravelling() || isReplaying()}
            label={isTravelling() ? "Timeline" : "History"}
          />

          <Show when={isTravelling()}>
            <Label class={styles["travel-info"]}>
              {travelIndex()}/{travelFenHistory().length - 1}
            </Label>
          </Show>

          <Show when={isTravelling() || isReplaying()}>
            <IconButton onClick={handleBackToLive} aria-label="Back to live">
              <CheckIcon />
            </IconButton>
          </Show>
        </div>
      </Show>

      <div
        class={clsx(styles.backdrop, open() && styles["backdrop--open"])}
        onClick={() => setOpen(false)}
      />

      <div class={clsx(styles.drawer, open() && styles["drawer--open"])}>
        <Label variant="section">Menu</Label>
        <div class={styles["menu-list"]}>
          <MenuButton primary href="/selena" onClick={() => setOpen(false)}>
            Play with Selena
          </MenuButton>
          <MenuButton href="/analysis" onClick={() => setOpen(false)}>
            Solo Analysis
          </MenuButton>
          <MenuButton
            href="/review"
            onClick={() => setOpen(false)}
            disabled={gameHistory().length === 0}
          >
            Review
          </MenuButton>
          <Label variant="caption" class={styles["coming-soon"]}>
            Coming soon!
          </Label>
          <MenuButton disabled>Learn to Play</MenuButton>
          <MenuButton disabled>Play LAN</MenuButton>
        </div>

        <Divider />

        <Label variant="section">Controls</Label>
        <div class={styles["controls-row"]}>
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
          <Show when={capabilities().flipBoard}>
            <IconButton
              label="Flip"
              onClick={() => {
                setActivePlayerColor(activePlayerColor() === "w" ? "b" : "w");
                setOpen(false);
              }}
              aria-label="Flip board"
            >
              <FlipBoardIcon />
            </IconButton>
          </Show>
          <IconButton
            label="Credits"
            onClick={() => {
              setOpen(false);
              setShowCredits(true);
            }}
            disabled={isReplaying() || isTravelling()}
            aria-label="Credits"
          >
            <StarIcon />
          </IconButton>
        </div>

        <Divider />

        <Label variant="section">Settings</Label>
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
