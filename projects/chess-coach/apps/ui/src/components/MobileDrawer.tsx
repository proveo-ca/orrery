// SPEC: _spec/chess-coach/ui/components.puml
import { useLocation } from "@solidjs/router";
import { Show, createSignal } from "solid-js";
import type { Component } from "solid-js";

import { CoachEmotionIcon } from "~/components/CoachEmotionIcon";
import { Divider } from "~/components/common/Divider";
import { IconButton } from "~/components/common/IconButton";
import {
  BookIcon,
  CheckIcon,
  CogIcon,
  FlagIcon,
  FlipBoardIcon,
  HintIcon,
  PlusCircleIcon,
  SearchIcon,
  StarIcon,
} from "~/components/common/icons";
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
import { resetGame } from "~/store/gameStore";
import { activePlayerColor, setActivePlayerColor } from "~/store/settingsStore";
import { isTravelling, travelFenHistory, travelIndex } from "~/store/travelStore.ts";

const isRoute = (pathname: string, route: string) =>
  pathname.endsWith(route) || pathname.includes(route + "/");

export const MobileDrawer: Component = () => {
  const location = useLocation();
  const [menuOpen, setMenuOpen] = createSignal(false);
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
    void baseHandleHint();
  };

  const handleResign = () => {
    setMenuOpen(false);
    baseHandleResign();
  };

  const inTimelineMode = () => isTravelling() || isReplaying();

  return (
    <div class={styles["mobile-only"]}>
      <div class={styles["top-left-nav"]}>
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

      <div class={styles["top-right-nav"]}>
        <Show when={capabilities().historyNav}>
          <DualNavButton
            onBack={handleBack}
            onForward={handleForward}
            backDisabled={atStart() && !isTravelling()}
            forwardDisabled={atLatest()}
            inverted={inTimelineMode()}
            label={isTravelling() ? "Timeline" : "History"}
          />
        </Show>

        <Show
          when={capabilities().historyNav && inTimelineMode()}
          fallback={
            <IconButton
              label="Settings"
              labelPosition="bottom"
              onClick={() => setMenuOpen(true)}
              aria-label="Open menu"
            >
              <CogIcon />
            </IconButton>
          }
        >
          <Show when={isTravelling()}>
            <span class={styles["travel-info"]}>
              {travelIndex()}/{travelFenHistory().length - 1}
            </span>
          </Show>
          <IconButton onClick={handleBackToLive} aria-label="Back to live">
            <CheckIcon />
          </IconButton>
        </Show>
      </div>

      <Modal open={menuOpen()} onClose={() => setMenuOpen(false)} title="Menu" position="fixed">
        <div class={styles["menu-modal"]}>
          <SettingsPanel onDismiss={() => setMenuOpen(false)} />

          <Divider />

          <div class={styles["menu-modal__icons"]}>
            <Show when={capabilities().aiOpponent}>
              <IconButton
                label="Resign"
                onClick={handleResign}
                disabled={isResigned()}
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
                  setMenuOpen(false);
                }}
                aria-label="Flip board"
              >
                <FlipBoardIcon />
              </IconButton>
            </Show>
            <IconButton
              label="Credits"
              onClick={() => {
                setMenuOpen(false);
                setShowCredits(true);
              }}
              aria-label="Credits"
            >
              <StarIcon />
            </IconButton>
          </div>

          <Divider />

          <div class={styles["menu-modal__icons"]}>
            <IconButton
              label="Coach"
              href="/selena"
              primary={isRoute(location.pathname, "/selena")}
              disabled={isRoute(location.pathname, "/selena")}
              onClick={() => setMenuOpen(false)}
              aria-label="Coach"
            >
              <CoachEmotionIcon emotion="happy" />
            </IconButton>
            <IconButton
              label="Analysis"
              href="/analysis"
              primary={isRoute(location.pathname, "/analysis")}
              disabled={isRoute(location.pathname, "/analysis")}
              onClick={() => setMenuOpen(false)}
              aria-label="Analysis"
            >
              <SearchIcon />
            </IconButton>
            <IconButton
              label="Review"
              href="/review"
              primary={isRoute(location.pathname, "/review")}
              disabled={isRoute(location.pathname, "/review")}
              onClick={() => setMenuOpen(false)}
              aria-label="Review"
            >
              <BookIcon />
            </IconButton>
          </div>
        </div>
      </Modal>

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
