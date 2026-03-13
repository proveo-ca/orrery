import { Chess } from "chess.js";
import { Show, onMount } from "solid-js";
import type { Component } from "solid-js";

import { CapturedPieces } from "~/components/CapturedPieces";
import { ChessBoard } from "~/components/ChessBoard";
import { CoachAdvice } from "~/components/CoachAdvice";
import { CoachAvatar } from "~/components/CoachAvatar.tsx";
import { HistoryOverlay } from "~/components/common/HistoryOverlay";
import { LightSpeedOverlay } from "~/components/common/LightSpeedOverlay";
import { SplashScreen } from "~/components/common/SplashScreen";
import { BoardActions } from "~/components/Controls";
import {
  DebugControls,
  debugHistoryOverlay,
  debugLightSpeedOverlay,
} from "~/components/DebugControls";
import { NewGamePanel } from "~/components/NewGamePanel";
import { useGlobalShortcuts } from "~/hooks/useGlobalShortcuts";
import { fetchHello, postAdviceStream, postMove } from "~/services/api";
import {
  dispatchCoachEvent,
  setAdvice,
  setBestMovePhrases,
  setThinkingPhrases,
} from "~/store/coachStore";
import { isAppReady } from "~/store/coachStore";
import { addMoveToHistory, currentFen, currentIndex, fenHistory } from "~/store/gameStore";
import { activePlayerColor, difficulty } from "~/store/settingsStore";
import { isTravelling } from "~/store/travelStore";
import { initGlobalLogging, logger } from "~/utils/logger";
import "~/theme.css";
import "~/App.css";

const App: Component = () => {
  useGlobalShortcuts();

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
      <SplashScreen />
      <Show when={isAppReady()}>
        <div class="app-container">
          <HistoryOverlay active={debugHistoryOverlay() || (isReplaying() && !isTravelling())} />
          <LightSpeedOverlay active={debugLightSpeedOverlay() || isTravelling()} />

          <div class="coach-header">
            <CoachAvatar />
            <CoachAdvice />
          </div>

          <div class="board-area">
            <BoardActions />
            <CapturedPieces />
            <ChessBoard />
          </div>

          <div class="footer">
            <NewGamePanel />
          </div>

          <DebugControls />
        </div>
      </Show>
    </>
  );
};

export default App;
