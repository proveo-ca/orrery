import { Chess } from "chess.js";
import { Show, createSignal, onMount } from "solid-js";
import type { Component } from "solid-js";

import styles from "~/App.module.css";
import { OpponentCaptures, PlayerCaptures } from "~/components/CapturedPieces";
import { ChessBoard } from "~/components/ChessBoard";
import { CoachPanel } from "~/components/CoachPanel.tsx";
import { CoachAvatar } from "~/components/CoachAvatar.tsx";
import { HistoryOverlay } from "~/components/common/HistoryOverlay";
import { LightSpeedOverlay } from "~/components/common/LightSpeedOverlay";
import { SplashScreen } from "~/components/common/SplashScreen";
import { Sidebar } from "~/components/Sidebar";
import {
  DebugControls,
  debugHistoryOverlay,
  debugLightSpeedOverlay,
} from "~/components/DebugControls";
import { useGlobalShortcuts } from "~/hooks/useGlobalShortcuts";
import { fetchHello, postAdviceStream, postMove } from "~/services/api";
import {
  dispatchCoachEvent,
  setAdvice,
  setBestMovePhrases,
  setThinkingPhrases,
} from "~/store/coachStore";
import { addMoveToHistory, currentFen, currentIndex, fenHistory } from "~/store/gameStore";
import { activePlayerColor, difficulty } from "~/store/settingsStore";
import { isTravelling } from "~/store/travelStore";
import "~/theme.css";
import { initGlobalLogging, logger } from "~/utils/logger";

const App: Component = () => {
  useGlobalShortcuts();
  const [gameStarted, setGameStarted] = createSignal(false);

  const isReplaying = () => currentIndex() < fenHistory().length - 1;

  onMount(async () => {
    initGlobalLogging();
    logger.action("App Mounted");

    try {
      const helloData = await fetchHello();

      if (fenHistory().length > 1) {
        setAdvice("Welcome back! Let's continue our game.");
      } else {
        setAdvice(helloData.greeting);
      }

      setThinkingPhrases(helloData.thinking);
      setBestMovePhrases(helloData.bestMove);
      dispatchCoachEvent({ type: "APP_READY" });

      // Check if it's the AI's turn to move
      const current = currentFen();
      const game = new Chess(current);
      const turn = current.split(" ")[1];

      if (!game.isGameOver() && turn !== activePlayerColor()) {
        dispatchCoachEvent({ type: "AI_THINKING" });
        setAdvice("Let me think about my next move...");

        postMove({
          humanMoveSan: "",
          fenAfterHuman: current,
          difficulty: difficulty(),
        })
          .then(async (moveData) => {
            const aiMove = game.move(moveData.move);
            addMoveToHistory(moveData.fen, { from: aiMove.from, to: aiMove.to });
            dispatchCoachEvent({ type: "AI_MOVED" });

            let fullAdvice = "";
            let receivedFirstChunk = false;
            await postAdviceStream(
              { humanMove: "", aiMove: moveData.move, fen: moveData.fen },
              (chunk) => {
                if (!receivedFirstChunk) {
                  fullAdvice = "";
                  receivedFirstChunk = true;
                }
                fullAdvice += chunk;
                setAdvice(fullAdvice);
              },
            );
          })
          .catch((err) => {
            logger.error("Failed to execute AI continuation move", err);
            setAdvice("Error getting my move.");
            dispatchCoachEvent({ type: "AI_ERROR" });
          });
      }
    } catch (err) {
      logger.error("Failed to fetch /hello", err);
      setAdvice("Hey! I couldn't connect to the server. Is it running?");
      dispatchCoachEvent({ type: "APP_ERROR" });
    }
  });

  return (
    <>
      <SplashScreen onStart={() => setGameStarted(true)} />
      <Show when={gameStarted()}>
        <div class={styles["app-container"]}>
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
        </div>
      </Show>
    </>
  );
};

export default App;
