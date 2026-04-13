import { onMount } from "solid-js";
import type { Component } from "solid-js";

import styles from "~/App.module.css";
import { OpponentCaptures, PlayerCaptures } from "~/components/CapturedPieces";
import { ChessBoard } from "~/components/ChessBoard";
import { CoachAvatar } from "~/components/CoachAvatar.tsx";
import { CoachPanel } from "~/components/CoachPanel.tsx";
import { HistoryOverlay } from "~/components/common/HistoryOverlay";
import { LightSpeedOverlay } from "~/components/common/LightSpeedOverlay";
import {
  DebugControls,
  debugHistoryOverlay,
  debugLightSpeedOverlay,
} from "~/components/DebugControls";
import { MobileDrawer } from "~/components/MobileDrawer";
import { Sidebar } from "~/components/Sidebar";
import { COACH_CAPABILITIES, setCapabilities } from "~/store/capabilitiesStore";
import { currentIndex, fenHistory } from "~/store/gameStore";
import { isTravelling } from "~/store/travelStore";

/**
 * "Playing with Selena" screen. Shows the coach avatar, advice panel, and
 * replay/travel overlays. Installs the Coach capability set on mount so
 * downstream hooks (useChessBoard, useHoverEvaluator, etc.) wire up the
 * full Coach experience: hint button, travel, blunder detection, AI
 * opponent, replay-lock on past positions.
 */
export const CoachScreen: Component = () => {
  onMount(() => setCapabilities(COACH_CAPABILITIES));

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

      <DebugControls />
      <MobileDrawer />
    </div>
  );
};
