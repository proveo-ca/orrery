// SPEC: _spec/chess-coach/ui/components.puml
import { createEffect, createSignal, on } from "solid-js";

import { setPendingHintUci } from "~/hooks/useGameControls";
import { lastAIMoveInfo, lastHumanMoveInfo } from "~/hooks/useMoveExecutor";
import { lastCoachEvent } from "~/store/coachStore";
import { finalizeGame, inProgressGame, pushMove, startNewRecord } from "~/store/gameHistoryStore";
import { game as gameFromStore } from "~/store/gameStore";
import { activePlayerColor, difficulty } from "~/store/settingsStore";

const STARTING_FEN_FALLBACK = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

/**
 * Per-move hint flag. Set to `true` by the public `markHintPressed()` (called
 * from useGameControls.handleHint) and consumed + cleared when the next human
 * move is recorded.
 */
const [hintPressedForNextMove, setHintPressedForNextMove] = createSignal(false);

/** Call this from the hint handler to flag the upcoming move. */
export const markHintPressed = () => setHintPressedForNextMove(true);

/**
 * Side-effect hook mounted on the CoachScreen. Records moves as they happen
 * (san + hasPressedHint + isAI). cpDelta and wasBestMove are NOT stored —
 * they're computed fresh via Stockfish at review time by `useGameAnalysis`.
 */
export function useGameRecorder() {
  // ---------- Mount-time backfill ----------
  // Start a record if none exists and the game isn't over. This covers:
  // - Fresh first game (history empty, no NEW_GAME event yet)
  // - Restored in-progress game (history non-empty, backfill moves)
  const g = gameFromStore();
  const history = g.history({ verbose: true });
  if (!inProgressGame() && !g.isGameOver()) {
    const startingFen = history.length > 0 ? STARTING_FEN_FALLBACK : g.fen();
    startNewRecord(crypto.randomUUID(), startingFen, activePlayerColor(), difficulty());
    for (const m of history) {
      pushMove({
        san: m.san,
        hasPressedHint: false,
        isAI: m.color !== activePlayerColor(),
      });
    }
  }

  // ---------- Coach-event driven lifecycle ----------
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

  // ---------- Per-move recording ----------
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
