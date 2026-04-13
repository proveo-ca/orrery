import type { Component } from "solid-js";

import styles from "~/App.module.css";
import { OpponentCaptures, PlayerCaptures } from "~/components/CapturedPieces";
import { ChessBoard } from "~/components/ChessBoard";
import { CoachAvatar } from "~/components/CoachAvatar.tsx";
import { CoachPanel } from "~/components/CoachPanel.tsx";
import { HistoryOverlay } from "~/components/common/HistoryOverlay";
import { LightSpeedOverlay } from "~/components/common/LightSpeedOverlay";
import { MobileDrawer } from "~/components/MobileDrawer";
import { Sidebar } from "~/components/Sidebar";
import {
  DebugControls,
  debugHistoryOverlay,
  debugLightSpeedOverlay,
} from "~/components/DebugControls";
import { currentIndex, fenHistory } from "~/store/gameStore";
import { isTravelling } from "~/store/travelStore";

export const GameScreen: Component = () => {
  const isReplaying = () => currentIndex() < fenHistory().length - 1;

  return (
    <div classList={{ [styles["app-container"]]: true, highlight: (isTravelling() || isReplaying()) }}>
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
