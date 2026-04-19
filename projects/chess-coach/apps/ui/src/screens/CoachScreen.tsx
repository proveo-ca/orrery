// SPEC: _spec/chess-coach/ui/components.puml
import { createSignal, onMount } from "solid-js";
import type { Component } from "solid-js";

import styles from "~/App.module.css";
import { OpponentCaptures, PlayerCaptures } from "~/components/CapturedPieces";
import { ChessBoard } from "~/components/ChessBoard";
import { CoachAvatar } from "~/components/CoachAvatar.tsx";
import { CoachPanel } from "~/components/CoachPanel.tsx";
import { HistoryOverlay } from "~/components/common/HistoryOverlay";
import { LightSpeedOverlay } from "~/components/common/LightSpeedOverlay";
import { Modal } from "~/components/common/Modal";
import {
  DebugControls,
  debugHistoryOverlay,
  debugLightSpeedOverlay,
} from "~/components/DebugControls";
import { MobileDrawer } from "~/components/MobileDrawer";
import { Sidebar } from "~/components/Sidebar";
import { useGameRecorder } from "~/hooks/useGameRecorder";
import { checkEngineSupport } from "~/services/browserSupport";
import { COACH_CAPABILITIES, setCapabilities } from "~/store/capabilitiesStore";
import { currentIndex, fenHistory, restoreGame } from "~/store/gameStore";
import { isTravelling } from "~/store/travelStore";

/**
 * "Playing with Selena" screen. Shows the coach avatar, advice panel, and
 * replay/travel overlays. Installs the Coach capability set on mount so
 * downstream hooks (useChessBoard, useHoverEvaluator, etc.) wire up the
 * full Coach experience: hint button, travel, blunder detection, AI
 * opponent, replay-lock on past positions.
 */
export const CoachScreen: Component = () => {
  const [unsupportedReason, setUnsupportedReason] = createSignal<string | null>(null);
  const [debugInfo, setDebugInfo] = createSignal<string>("");

  // Passively record this game (PGN + per-move annotations) for later
  // review at /review/:id. Mounted here so it only runs on the Coach
  // screen where the AI-driven metadata (best-move, hint) is meaningful.
  useGameRecorder();

  onMount(() => {
    setCapabilities(COACH_CAPABILITIES);

    // Restore the coach's live game from localStorage. Other screens
    // (Review, Analysis) load ephemeral positions into gameStore without
    // persisting, so the coach's slot is still intact. If the restored
    // game was resigned / over, the game-over modal shows naturally.
    restoreGame();

    const { supported, reason, debug } = checkEngineSupport();
    if (!supported) {
      setUnsupportedReason(reason);
      setDebugInfo(debug);
    }
  });

  const isReplaying = () => currentIndex() < fenHistory().length - 1;

  return (
    <div
      classList={{ [styles["app-container"]]: true, highlight: isTravelling() || isReplaying() }}
    >
      <HistoryOverlay active={debugHistoryOverlay() || (isReplaying() && !isTravelling())} />
      <LightSpeedOverlay active={debugLightSpeedOverlay() || isTravelling()} />

      <div class={styles["coach-header"]}>
        <CoachAvatar />
      </div>

      <div class={styles["board-area"]}>
        <div class={styles["board-column"]}>
          <OpponentCaptures />
          <ChessBoard />
          <PlayerCaptures />
        </div>
        <Sidebar />
      </div>

      <div class={styles.footer}>
        <CoachPanel />
      </div>

      <Modal
        open={!!unsupportedReason()}
        title="Browser Not Supported"
        onClose={() => setUnsupportedReason(null)}
      >
        <p>{unsupportedReason()}</p>
        <p>
          Please try <strong>Chrome</strong>, <strong>Brave</strong>, <strong>Safari</strong>,{" "}
          <strong>Edge</strong>, or <strong>Firefox</strong> for the best experience.
        </p>
        <details>
          <summary style={{ "font-size": "0.8rem", cursor: "pointer", color: "#999" }}>
            Debug info
          </summary>
          <pre style={{ "font-size": "0.7rem", "white-space": "pre-wrap", color: "#888" }}>
            {debugInfo()}
          </pre>
        </details>
      </Modal>

      <DebugControls />
      <MobileDrawer />
    </div>
  );
};
