// SPEC: _spec/chess-coach/ui/components.puml
import { Show, createSignal } from "solid-js";
import type { Component, JSX } from "solid-js";

import { ResignConfirm } from "~/components/atoms/ResignConfirm";
import { MobileSidebar } from "~/components/features/MobileSidebar";
import { DualNavButton } from "~/components/primitives/DualNavButton";
import { IconButton } from "~/components/primitives/IconButton";
import { FlagIcon, FlipBoardIcon, HintIcon, PlusCircleIcon } from "~/components/primitives/icons";
import { useGameControls } from "~/hooks/useGameControls";
import { useHintSparkle } from "~/hooks/useHintSparkle";
import { capabilities } from "~/store/capabilitiesStore";
import { resetGame, reviewAnalysisMode } from "~/store/gameStore";
import { activePlayerColor, setActivePlayerColor } from "~/store/settingsStore";
import { isTravelling, travelFenHistory, travelIndex } from "~/store/travelStore.ts";

/**
 * The MobileSidebar bar for the engine-backed board screens (Coach / Analysis /
 * Review): a per-screen `center` slot + up to four capability-gated quick
 * actions — hint, history nav, resign, flip, new game. The full option set
 * (settings, credits, routes) lives in the {@link MobileDrawer} hamburger.
 * Resign's confirm dialog renders as a sibling of the bar (not an Item), so the
 * bar's fan-out / max-4 rules don't touch it.
 */
export const BoardControls: Component<{ center?: JSX.Element }> = (props) => {
  const { hintSparkleClass, dismissHintSparkle } = useHintSparkle();
  const {
    atStart,
    atLatest,
    isReplaying,
    isResigned,
    pendingHint,
    handleBack,
    handleForward,
    handleBackToLive,
    handleHint,
    handleResign: baseHandleResign,
  } = useGameControls();
  const [showResignConfirm, setShowResignConfirm] = createSignal(false);
  const inTimelineMode = () => isTravelling() || isReplaying() || reviewAnalysisMode();

  return (
    <>
      <MobileSidebar>
        <MobileSidebar.Main>{props.center}</MobileSidebar.Main>

        <Show when={capabilities().hint}>
          <MobileSidebar.Item>
            <IconButton
              class={hintSparkleClass()}
              onClick={() => {
                dismissHintSparkle();
                void handleHint();
              }}
              disabled={pendingHint() || isReplaying() || isTravelling()}
              aria-label="Get a hint"
            >
              <HintIcon />
            </IconButton>
          </MobileSidebar.Item>
        </Show>

        <Show when={capabilities().historyNav}>
          <MobileSidebar.Item>
            <DualNavButton
              onBack={handleBack}
              onForward={handleForward}
              backDisabled={atStart() && !isTravelling()}
              forwardDisabled={atLatest()}
              inverted={inTimelineMode()}
              showBackToLive={inTimelineMode()}
              onBackToLive={handleBackToLive}
              label={
                isTravelling()
                  ? `Timeline ${travelIndex()}/${travelFenHistory().length - 1}`
                  : inTimelineMode()
                    ? "History"
                    : undefined
              }
            />
          </MobileSidebar.Item>
        </Show>

        <Show when={capabilities().aiOpponent}>
          <MobileSidebar.Item>
            <IconButton
              onClick={() => setShowResignConfirm(true)}
              disabled={isResigned() || isReplaying() || isTravelling()}
              aria-label="Resign"
            >
              <FlagIcon />
            </IconButton>
          </MobileSidebar.Item>
        </Show>

        <Show when={capabilities().flipBoard}>
          <MobileSidebar.Item>
            <IconButton
              onClick={() => setActivePlayerColor(activePlayerColor() === "w" ? "b" : "w")}
              aria-label="Flip board"
            >
              <FlipBoardIcon />
            </IconButton>
          </MobileSidebar.Item>
        </Show>

        <Show when={!capabilities().aiOpponent && !capabilities().readOnly}>
          <MobileSidebar.Item>
            <IconButton onClick={() => resetGame()} aria-label="New game">
              <PlusCircleIcon />
            </IconButton>
          </MobileSidebar.Item>
        </Show>
      </MobileSidebar>

      <ResignConfirm
        open={showResignConfirm()}
        onClose={() => setShowResignConfirm(false)}
        onConfirm={() => {
          setShowResignConfirm(false);
          baseHandleResign();
        }}
      />
    </>
  );
};
