import { onCleanup, onMount } from "solid-js";
import type { Component } from "solid-js";

import { OpponentCaptures, PlayerCaptures } from "~/components/atoms/CapturedPieces";
import { DebugControls } from "~/components/atoms/DebugControls";
import { FenLoader } from "~/components/atoms/FenLoader";
import { ChessBoard } from "~/components/features/ChessBoard";
import { MobileDrawer } from "~/components/features/MobileDrawer";
import { Sidebar } from "~/components/features/Sidebar";
import { Screen } from "~/components/primitives/Screen";
import { ANALYSIS_CAPABILITIES, setCapabilities } from "~/store/capabilitiesStore";
import { inProgressGame } from "~/store/gameHistoryStore";
import { persistFreshStart } from "~/store/gameStore";
import { imLost, setImLost } from "~/store/settingsStore";

/**
 * Solo Analysis screen. No coach avatar, no advice panel, no replay or
 * travel overlays. Installs the Analysis capability set on mount so
 * downstream hooks switch to analysis behavior: continuous Stockfish
 * analysis with best-move highlighting, both colors playable, past
 * positions branch on new moves, no AI opponent, no blunder detection,
 * no hint button.
 */
export const AnalysisScreen: Component = () => {
  let previousImLost = false;

  onMount(() => {
    // Circuit-breaker: if no game is active, persist a clean starting
    // position so that navigating to /selena restores fresh instead of
    // loading a corrupted or stale game state from localStorage.
    if (!inProgressGame()) persistFreshStart();

    setCapabilities(ANALYSIS_CAPABILITIES);
    previousImLost = imLost();
    setImLost(true);
  });

  onCleanup(() => {
    setImLost(previousImLost);
  });

  return (
    <Screen>
      <Screen.SidebarInset class="mobile-nav-clear">
        <FenLoader />
      </Screen.SidebarInset>
      <Screen.BoardArea>
        <Screen.BoardColumn>
          <OpponentCaptures />
          <ChessBoard />
          <PlayerCaptures />
        </Screen.BoardColumn>
        <Sidebar />
      </Screen.BoardArea>

      <DebugControls />
      <MobileDrawer />
    </Screen>
  );
};
