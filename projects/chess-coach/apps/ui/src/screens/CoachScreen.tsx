// SPEC: _spec/chess-coach/ui/components.puml
import { createSignal, onMount } from "solid-js";
import type { Component } from "solid-js";

import { OpponentCaptures, PlayerCaptures } from "~/components/atoms/CapturedPieces";
import { CoachAvatar } from "~/components/atoms/CoachAvatar.tsx";
import {
  DebugControls,
  debugHistoryOverlay,
  debugLightSpeedOverlay,
} from "~/components/atoms/DebugControls";
import { LightSpeedOverlay } from "~/components/atoms/LightSpeedOverlay";
import { Modal } from "~/components/atoms/Modal";
import { BoardControls } from "~/components/features/BoardControls";
import { ChessBoard } from "~/components/features/ChessBoard";
import { CoachPanel } from "~/components/features/CoachPanel.tsx";
import { MobileDrawer } from "~/components/features/MobileDrawer";
import { Sidebar } from "~/components/features/Sidebar";
import { HistoryOverlay } from "~/components/primitives/HistoryOverlay";
import { Screen } from "~/components/primitives/Screen";
import { useGameRecorder } from "~/hooks/useGameRecorder";
import { useLivePreAnalysis } from "~/hooks/useLivePreAnalysis";
import { fetchHello, postAdviceStream, postMove } from "~/services/api";
import { checkEngineSupport } from "~/services/browserSupport";
import { accumulateStream } from "~/services/streamUtils";
import { COACH_CAPABILITIES, setCapabilities } from "~/store/capabilitiesStore";
import {
  dispatchCoachEvent,
  setAdvice,
  setBestMovePhrases,
  setThinkingPhrases,
} from "~/store/coachStore";
import {
  addMoveSan,
  currentFen,
  currentIndex,
  fenHistory,
  game,
  restoreGame,
} from "~/store/gameStore";
import { activePlayerColor, difficulty } from "~/store/settingsStore";
import { isTravelling } from "~/store/travelStore";
import { logger } from "~/utils/logger";

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

  // Warm the review-analysis cache as moves are recorded (background
  // priority), so opening Review after the game is instant/near-instant.
  useLivePreAnalysis();

  onMount(async () => {
    setCapabilities(COACH_CAPABILITIES);

    // Restore the coach's live game from localStorage. Other screens
    // (Review, Analysis) load ephemeral positions into gameStore without
    // persisting, so the coach's slot is still intact. If the restored
    // game was resigned / over, the game-over modal shows naturally.
    restoreGame();

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

      const g = game();
      const turn = currentFen().split(" ")[1];

      if (!g.isGameOver() && turn !== activePlayerColor()) {
        dispatchCoachEvent({ type: "AI_THINKING" });
        setAdvice("Let me think about my next move...");

        postMove({
          humanMoveSan: "",
          fenAfterHuman: currentFen(),
          difficulty: difficulty(),
        })
          .then(async (moveData) => {
            addMoveSan(moveData.move);
            dispatchCoachEvent({ type: "AI_MOVED" });

            await accumulateStream(
              postAdviceStream,
              { humanMove: "", aiMove: moveData.move, fen: moveData.fen },
              setAdvice,
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

    const { supported, reason, debug } = checkEngineSupport();
    if (!supported) {
      setUnsupportedReason(reason);
      setDebugInfo(debug);
    }
  });

  const isReplaying = () => currentIndex() < fenHistory().length - 1;

  return (
    <Screen highlight={isTravelling() || isReplaying()}>
      <HistoryOverlay active={debugHistoryOverlay() || (isReplaying() && !isTravelling())} />
      <LightSpeedOverlay active={debugLightSpeedOverlay() || isTravelling()} />

      <Screen.Header>
        {/* Desktop shows the avatar here; on mobile it moves into the bar. */}
        <div class="desktop-only">
          <CoachAvatar />
        </div>
      </Screen.Header>

      <Screen.BoardArea>
        <Screen.BoardColumn>
          <BoardControls center={<CoachAvatar compact />} />
          <OpponentCaptures />
          <ChessBoard />
          <PlayerCaptures />
        </Screen.BoardColumn>
        <Sidebar />
      </Screen.BoardArea>

      <Screen.Footer>
        <CoachPanel />
      </Screen.Footer>

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
    </Screen>
  );
};
