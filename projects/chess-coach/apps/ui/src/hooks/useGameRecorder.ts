import { createEffect, createSignal, on } from "solid-js";

import { setPendingHintUci } from "~/hooks/useGameControls";
import { lastAIMoveInfo, lastHumanMoveInfo } from "~/hooks/useMoveExecutor";
import { lastCoachEvent } from "~/store/coachStore";
import { finalizeGame, inProgressGame, pushMove, startNewRecord } from "~/store/gameHistoryStore";
import { game as gameFromStore } from "~/store/gameStore";
import { activePlayerColor, difficulty, opponentIdentity, playerIdentity } from "~/store/settingsStore";

const STARTING_FEN_FALLBACK = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

const [hintPressedForNextMove, setHintPressedForNextMove] = createSignal(false);

export const markHintPressed = () => setHintPressedForNextMove(true);

export function useGameRecorder() {
  const g = gameFromStore();
  const history = g.history({ verbose: true });
  if (!inProgressGame() && !g.isGameOver()) {
    const startingFen = history.length > 0 ? STARTING_FEN_FALLBACK : g.fen();
    startNewRecord(
      crypto.randomUUID(),
      startingFen,
      activePlayerColor(),
      difficulty(),
      playerIdentity(),
      opponentIdentity(),
    );
    for (const m of history) {
      pushMove({
        san: m.san,
        hasPressedHint: false,
        isAI: m.color !== activePlayerColor(),
      });
    }
  }

  createEffect(
    on(lastCoachEvent, (event) => {
      if (!event) return;

      if (event.type === "NEW_GAME") {
        const startingFen = gameFromStore().fen();
        startNewRecord(
          crypto.randomUUID(),
          startingFen || STARTING_FEN_FALLBACK,
          activePlayerColor(),
          difficulty(),
          playerIdentity(),
          opponentIdentity(),
        );
        setPendingHintUci(null);
        setHintPressedForNextMove(false);
        return;
      }

      if (event.type === "GAME_OVER") {
        queueMicrotask(() => {
          finalizeGame(event.result, gameFromStore().pgn());
        });
      }
    }),
  );

  createEffect(
    on(lastHumanMoveInfo, (info) => {
      if (!info) return;
      const hasPressedHint = hintPressedForNextMove();
      setHintPressedForNextMove(false);

      pushMove({
        san: info.san,
        hasPressedHint,
        isAI: false,
      });
    }),
  );

  createEffect(
    on(lastAIMoveInfo, (info) => {
      if (!info) return;
      pushMove({
        san: info.san,
        hasPressedHint: false,
        isAI: true,
      });
    }),
  );
}
