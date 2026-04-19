// SPEC: _spec/chess-coach/ui/components.puml
import { onMount } from "solid-js";
import type { Component } from "solid-js";

import styles from "~/App.module.css";
import { OpponentCaptures, PlayerCaptures } from "~/components/CapturedPieces";
import { ChessBoard } from "~/components/ChessBoard";
import { DebugControls } from "~/components/DebugControls";
import { FenLoader } from "~/components/FenLoader";
import { MobileDrawer } from "~/components/MobileDrawer";
import { Sidebar } from "~/components/Sidebar";
import { ANALYSIS_CAPABILITIES, setCapabilities } from "~/store/capabilitiesStore";

/**
 * Solo Analysis screen. No coach avatar, no advice panel, no replay or
 * travel overlays. Installs the Analysis capability set on mount so
 * downstream hooks switch to analysis behavior: continuous Stockfish
 * analysis with best-move highlighting, both colors playable, past
 * positions branch on new moves, no AI opponent, no blunder detection,
 * no hint button.
 */
export const AnalysisScreen: Component = () => {
  onMount(() => {
    setCapabilities(ANALYSIS_CAPABILITIES);
  });

  return (
    <div class={styles["app-container"]}>
      <FenLoader />
      <div class={styles["board-area"]}>
        <div class={styles["board-column"]}>
          <OpponentCaptures />
          <ChessBoard />
          <PlayerCaptures />
        </div>
        <Sidebar />
      </div>

      <DebugControls />
      <MobileDrawer />
    </div>
  );
};
