// SPEC: _spec/chess-coach/ui/components.puml
import { useLocation } from "@solidjs/router";
import { Show, createSignal } from "solid-js";
import type { Component } from "solid-js";

import { Credits } from "~/components/atoms/Credits";
import { Modal } from "~/components/atoms/Modal";
import { ResignConfirm } from "~/components/atoms/ResignConfirm";
import styles from "~/components/features/MobileDrawer.module.css";
import { NewGamePanel } from "~/components/features/NewGamePanel";
import { SettingsPanel } from "~/components/features/Settings";
import { CoachEmotionIcon } from "~/components/primitives/CoachEmotionIcon";
import { Divider } from "~/components/primitives/Divider";
import { DualNavButton } from "~/components/primitives/DualNavButton";
import { IconButton } from "~/components/primitives/IconButton";
import {
  BookIcon,
  FlagIcon,
  FlipBoardIcon,
  HamburgerIcon,
  HintIcon,
  PlusCircleIcon,
  SearchIcon,
  StarIcon,
} from "~/components/primitives/icons";
import { useGameControls } from "~/hooks/useGameControls";
import { useHintSparkle } from "~/hooks/useHintSparkle";
import { capabilities } from "~/store/capabilitiesStore";
import { setShowCredits, setShowNewGame, showCredits, showNewGame } from "~/store/coachStore";
import { resetGame, reviewAnalysisMode } from "~/store/gameStore";
import { activePlayerColor, setActivePlayerColor } from "~/store/settingsStore";
import { isTravelling, travelFenHistory, travelIndex } from "~/store/travelStore.ts";

const isRoute = (pathname: string, route: string) =>
  pathname.endsWith(route) || pathname.includes(route + "/");

/**
 * Mobile hamburger (top-left) that opens the full menu — every desktop-Sidebar
 * option (history nav, hint, resign, new game, flip, credits, settings) plus
 * the screen routes. The quick actions live in the {@link MobileSidebar} bar;
 * this is the complete set. Hidden on desktop, where the Sidebar shows.
 */
export const MobileDrawer: Component = () => {
  const location = useLocation();
  const [menuOpen, setMenuOpen] = createSignal(false);
  const [showResignConfirm, setShowResignConfirm] = createSignal(false);
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

  const close = () => setMenuOpen(false);
  const handleHint = () => {
    dismissHintSparkle();
    void baseHandleHint();
    close();
  };
  const handleResign = () => {
    close();
    setShowResignConfirm(true);
  };
  const confirmResign = () => {
    setShowResignConfirm(false);
    baseHandleResign();
  };
  const inTimelineMode = () => isTravelling() || isReplaying() || reviewAnalysisMode();

  return (
    <>
      <button class={styles.hamburger} onClick={() => setMenuOpen(true)} aria-label="Open menu">
        <HamburgerIcon />
      </button>

      <Modal open={menuOpen()} onClose={close} title="Menu" position="fixed">
        <div class={styles["menu-modal"]}>
          <Show when={capabilities().historyNav}>
            <DualNavButton
              onBack={handleBack}
              onForward={handleForward}
              backDisabled={atStart() && !isTravelling()}
              forwardDisabled={atLatest()}
              inverted={inTimelineMode()}
              label={
                isTravelling()
                  ? `Timeline ${travelIndex()}/${travelFenHistory().length - 1}`
                  : inTimelineMode()
                    ? "History"
                    : undefined
              }
              showBackToLive={inTimelineMode()}
              onBackToLive={handleBackToLive}
            />
          </Show>

          <div class={styles["menu-modal__icons"]}>
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
                disabled={isResigned()}
                aria-label="Resign"
              >
                <FlagIcon />
              </IconButton>
            </Show>
            <Show when={!capabilities().aiOpponent && !capabilities().readOnly}>
              <IconButton
                label="New Game"
                onClick={() => {
                  resetGame();
                  close();
                }}
                aria-label="New game"
              >
                <PlusCircleIcon />
              </IconButton>
            </Show>
            <Show when={capabilities().flipBoard}>
              <IconButton
                label="Flip"
                onClick={() => {
                  setActivePlayerColor(activePlayerColor() === "w" ? "b" : "w");
                  close();
                }}
                aria-label="Flip board"
              >
                <FlipBoardIcon />
              </IconButton>
            </Show>
            <IconButton
              label="Credits"
              onClick={() => {
                close();
                setShowCredits(true);
              }}
              aria-label="Credits"
            >
              <StarIcon />
            </IconButton>
          </div>

          <Divider />
          <SettingsPanel onDismiss={close} />
          <Divider />

          <div class={styles["menu-modal__icons"]}>
            <IconButton
              label="Coach"
              href="/selena"
              primary={isRoute(location.pathname, "/selena")}
              disabled={isRoute(location.pathname, "/selena")}
              onClick={close}
              aria-label="Coach"
            >
              <CoachEmotionIcon emotion="happy" />
            </IconButton>
            <IconButton
              label="Analysis"
              href="/analysis"
              primary={isRoute(location.pathname, "/analysis")}
              disabled={isRoute(location.pathname, "/analysis")}
              onClick={close}
              aria-label="Analysis"
            >
              <SearchIcon />
            </IconButton>
            <IconButton
              label="Review"
              href="/review"
              primary={isRoute(location.pathname, "/review")}
              disabled={isRoute(location.pathname, "/review")}
              onClick={close}
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

      <ResignConfirm
        open={showResignConfirm()}
        onClose={() => setShowResignConfirm(false)}
        onConfirm={confirmResign}
      />

      <Credits open={showCredits()} onClose={() => setShowCredits(false)} />
    </>
  );
};
