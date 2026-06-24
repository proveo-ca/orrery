// SPEC: _spec/chess-coach/multiplayer.puml
import { createEffect, on, onCleanup } from "solid-js";

import {
  discardInProgress,
  finalizeGame,
  inProgressGame,
  pushMove,
  startNewRecord,
} from "~/store/gameHistoryStore";
import { fenHistory, game as gameFromStore, startingFen } from "~/store/gameStore";
import { gameOver, myColor, playerByColor, started } from "~/store/roomStore";
import { playerName } from "~/store/settingsStore";
import type { Color, GameOverInfo } from "~/types/multiplayer";
import type { GameResult } from "~/types/game";

const LAN_FALLBACK_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

/** Map a LAN verdict to the local player's win/loss/draw perspective. */
function resultFor(me: Color | null, over: GameOverInfo): GameResult {
  if (over.result === "draw") return "draw";
  const iWon = (over.result === "white" && me === "w") || (over.result === "black" && me === "b");
  return iWon ? "win" : "loss";
}

/**
 * Records the live LAN game into gameHistory so it can be reviewed at
 * /review/:id, mirroring what {@link useGameRecorder} does for the Coach. That
 * recorder is driven by coach move/event signals (lastHumanMoveInfo,
 * lastCoachEvent) which the engine-free LAN board never emits, so here we drive
 * recording off the room + game stores instead: start a record when the game
 * begins, append each ply as the position advances (local or relayed), and
 * finalize on game over. Combined with `useLivePreAnalysis`, opening Review
 * afterwards is warm. Only the two players record (observers do not).
 */
export function useLanGameRecorder() {
  // The record this hook owns. Guards the effects below so they never touch a
  // leftover Coach in-progress record that happens to outlive its screen.
  let myRecordId: string | null = null;
  let recordedPlies = 0;

  createEffect(
    on(started, (isStarted) => {
      if (!isStarted) return;
      const me = myColor();
      if (!me) return; // observers don't record a personal game
      myRecordId = crypto.randomUUID();
      recordedPlies = 0;
      const opponentName = playerByColor(me === "w" ? "b" : "w")?.identity.name;
      startNewRecord(
        myRecordId,
        startingFen() || LAN_FALLBACK_FEN,
        me,
        "lan",
        undefined,
        undefined,
        playerName(),
        opponentName,
      );
    }),
  );

  // Append each new ply as the live position grows. fenHistory() tracks the full
  // move list (not the view cursor), so history navigation never retriggers it.
  createEffect(
    on(
      () => fenHistory().length,
      () => {
        const rec = inProgressGame();
        if (!rec || rec.id !== myRecordId) return;
        const verbose = gameFromStore().history({ verbose: true });
        while (recordedPlies < verbose.length) {
          pushMove({ san: verbose[recordedPlies].san, hasPressedHint: false, isAI: false });
          recordedPlies++;
        }
      },
    ),
  );

  createEffect(
    on(gameOver, (over) => {
      if (!over) return;
      const rec = inProgressGame();
      if (!rec || rec.id !== myRecordId) return;
      finalizeGame(resultFor(myColor(), over), gameFromStore().pgn());
      myRecordId = null;
    }),
  );

  // Leaving LAN mid-game would otherwise leave our unfinished record lingering,
  // which blocks the Coach recorder (it only starts one when none exists).
  onCleanup(() => {
    if (myRecordId && inProgressGame()?.id === myRecordId) discardInProgress();
  });
}
