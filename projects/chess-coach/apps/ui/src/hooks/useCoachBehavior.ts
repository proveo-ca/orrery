// SPEC: _spec/chess-coach/ui/components.puml
import { createEffect } from "solid-js";

import { postAdviceStream } from "~/services/api";
import { accumulateStream } from "~/services/streamUtils";
import { capabilities } from "~/store/capabilitiesStore";
import {
  bestMovePhrases,
  dispatchCoachEvent,
  setAdvice,
  setAdviceArrow,
  setAdviceHoveredSquares,
  thinkingPhrases,
} from "~/store/coachStore";
import { type PlayerIdentity, playerIdentity } from "~/store/settingsStore";
import { logger } from "~/utils/logger";
import { lastAIError, lastAIMoveInfo, lastHumanMoveInfo } from "~/hooks/useMoveExecutor";

const QUEEN_CAPTURE_PHRASES: Record<PlayerIdentity, string[]> = {
  Human: [
    "I am the real Queen.",
    "That other Queen was too ugly anyway.",
    "The best piece, but not all is lost.",
    "Goodbye, Your Majesty. I won't miss you.",
  ],
  Cat: [
    "An honorable fight, your Highness.",
    "I guess I'm the new Lioness now.",
    "Miscalculated zoomies.",
    "She fought well, but I had all my nine lives.",
  ],
  Dog: [
    "The moon is sad today.",
    "Fierce battle, respect.",
    "I'll remember her in the moonlight.",
    "The bravest. Almost got me.",
  ],
  Rat: [
    "The legendary Kugaan Jaad is mine.",
    "Hopefully the Haida people will understand me.",
    "Sorry King Capy, no more Queen.",
    "Too strong for that undeserving army.",
  ],
};

export function useCoachBehavior() {
  let _adviceController: AbortController | null = null;
  let _thinkingTimer: ReturnType<typeof setTimeout> | null = null;

  const cancelThinkingPhrase = () => {
    if (_thinkingTimer !== null) {
      clearTimeout(_thinkingTimer);
      _thinkingTimer = null;
    }
  };

  const scheduleThinkingPhrase = () => {
    cancelThinkingPhrase();
    _thinkingTimer = setTimeout(() => {
      _thinkingTimer = null;
      const phrases = thinkingPhrases();
      setAdvice(phrases[Math.floor(Math.random() * phrases.length)]);
    }, 3000);
  };

  const abortAdvice = () => {
    cancelThinkingPhrase();
    _adviceController?.abort();
    _adviceController = null;
  };

  createEffect(() => {
    const info = lastHumanMoveInfo();
    if (!info || !capabilities().aiOpponent) return;

    abortAdvice();
    setAdviceArrow(null);
    setAdviceHoveredSquares([]);

    if (info.gameOver) {
      dispatchCoachEvent({ type: "GAME_OVER", result: info.gameOver.result });
      setAdvice(info.gameOver.message);
      return;
    }

    if (info.wasBestMove) {
      const phrases = bestMovePhrases();
      setAdvice(phrases[Math.floor(Math.random() * phrases.length)]);
      dispatchCoachEvent({ type: "HUMAN_MOVE_BEST" });
    } else {
      dispatchCoachEvent({ type: "HUMAN_MOVE_NORMAL" });
      // With commentary the thinking phrase is a placeholder that the streamed
      // advice will replace, so show it immediately. Without commentary it is
      // the final string, so delay it to avoid an instant filler line.
      if (capabilities().commentary) {
        const phrases = thinkingPhrases();
        setAdvice(phrases[Math.floor(Math.random() * phrases.length)]);
      } else {
        scheduleThinkingPhrase();
      }
    }
  });

  createEffect(() => {
    const info = lastAIMoveInfo();
    if (!info) return;

    cancelThinkingPhrase();

    if (info.gameOver) {
      dispatchCoachEvent({ type: "GAME_OVER", result: info.gameOver.result });
      setAdvice(info.gameOver.message);
      return;
    }

    if (info.captured === "q") {
      const phrases = QUEEN_CAPTURE_PHRASES[playerIdentity()];
      setAdvice(phrases[Math.floor(Math.random() * phrases.length)]);
      dispatchCoachEvent({ type: "HUMAN_MOVE_BEST" });
      return;
    }

    dispatchCoachEvent({ type: "AI_MOVED" });
    // postAdviceStream is a no-op when commentary is unavailable (see api.ts),
    // so this can call uniformly without a capability gate here.
    void _streamAdvice(info.humanMoveSan, { fen: info.fen, move: info.move });
  });

  createEffect(() => {
    const err = lastAIError();
    if (!err) return;
    setAdvice(err);
    dispatchCoachEvent({ type: "AI_ERROR" });
  });

  const _streamAdvice = async (
    humanMoveSan: string,
    moveData: { fen: string; move: string },
  ) => {
    const controller = new AbortController();
    _adviceController = controller;

    try {
      const fullAdvice = await accumulateStream(
        postAdviceStream,
        { humanMove: humanMoveSan, aiMove: moveData.move, fen: moveData.fen },
        setAdvice,
        { signal: controller.signal },
      );

      if (_adviceController !== controller) return;
      const lower = fullAdvice.toLowerCase();
      const isBlunder = lower.includes("blunder") || lower.includes("mistake");
      dispatchCoachEvent({ type: "ADVICE_RECEIVED", isBlunder });
    } catch (err: any) {
      if (err.name === "AbortError") {
        logger.action("Advice request aborted due to new move.");
      } else {
        logger.error("Advice stream failed", err);
        setAdvice("Error getting advice.");
        dispatchCoachEvent({ type: "AI_ERROR" });
      }
    } finally {
      if (_adviceController === controller) _adviceController = null;
    }
  };

  return { abortAdvice };
}
