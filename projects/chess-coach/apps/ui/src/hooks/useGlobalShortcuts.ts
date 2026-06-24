// SPEC: _spec/chess-coach/ui/components.puml
import { onCleanup, onMount } from "solid-js";

import { useTravelMode } from "~/hooks/useTravelMode";
import { capabilities } from "~/store/capabilitiesStore";
import {
  clearHoverOverride,
  coachEmotion,
  dispatchCoachEvent,
  hoverBlunder,
  hoverBlunderFen,
  hoverBlunderSan,
  pendingTravel,
} from "~/store/coachStore";
import {
  currentIndex,
  fenHistory,
  goBack,
  goForward,
  loadGame,
  reviewAnalysisMode,
  savedReviewBranchIndex,
  savedReviewPgn,
  savedReviewStartingFen,
  setReviewAnalysisMode,
  setViewIndex,
} from "~/store/gameStore";
import {
  exitTravel,
  isTravelling,
  travelBack,
  travelForward,
  travelIndex,
} from "~/store/travelStore";

export function useGlobalShortcuts() {
  const { activateTravel, loading } = useTravelMode();

  const handleKeyDown = (e: KeyboardEvent) => {
    if (coachEmotion() === "sleepy" || coachEmotion() === "sleeping") {
      dispatchCoachEvent({ type: "WAKE_UP" });
    }

    const isReplaying = () =>
      !capabilities().historyBranching && currentIndex() < fenHistory().length - 1;

    const pending = pendingTravel();
    if (
      e.code === "Space" &&
      capabilities().travel &&
      (hoverBlunder() || pending) &&
      !isTravelling() &&
      !loading()
    ) {
      e.preventDefault();
      const fen = hoverBlunderFen() ?? pending?.blunderFen;
      const san = hoverBlunderSan() ?? pending?.blunderSan;
      const fenBefore = pending?.fenBefore;
      if (fen && san) activateTravel(fen, san, fenBefore);
    } else if (e.code === "Escape") {
      if (reviewAnalysisMode()) {
        e.preventDefault();
        const pgn = savedReviewPgn();
        const fen = savedReviewStartingFen();
        const branchIndex = savedReviewBranchIndex();
        if (pgn || fen) {
          loadGame({ pgn, startingFen: fen });
          setViewIndex(branchIndex);
          setReviewAnalysisMode(false);
        }
      } else if (isTravelling() || isReplaying()) {
        e.preventDefault();
        if (isTravelling()) exitTravel();
        while (currentIndex() < fenHistory().length - 1) {
          goForward();
        }
        clearHoverOverride();
      }
    } else if (e.code === "ArrowLeft") {
      e.preventDefault();
      if (isTravelling()) {
        if (travelIndex() === 0) {
          exitTravel();
          clearHoverOverride();
        } else {
          travelBack();
        }
      } else {
        goBack();
      }
    } else if (e.code === "ArrowRight") {
      e.preventDefault();
      if (isTravelling()) {
        travelForward();
      } else {
        goForward();
      }
    }
  };

  onMount(() => {
    window.addEventListener("keydown", handleKeyDown);
  });

  onCleanup(() => {
    window.removeEventListener("keydown", handleKeyDown);
  });
}
