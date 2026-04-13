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
} from "~/store/coachStore";
import { currentIndex, fenHistory, goBack, goForward } from "~/store/gameStore";
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

    if (
      e.code === "Space" &&
      capabilities().travel &&
      hoverBlunder() &&
      !isTravelling() &&
      !loading()
    ) {
      e.preventDefault();
      const fen = hoverBlunderFen();
      const san = hoverBlunderSan();
      if (fen && san) activateTravel(fen, san);
    } else if (e.code === "Escape") {
      if (isTravelling() || isReplaying()) {
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
