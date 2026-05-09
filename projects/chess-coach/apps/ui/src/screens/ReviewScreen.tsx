import { useParams } from "@solidjs/router";
import { Show, createEffect, createMemo, on, onCleanup } from "solid-js";
import type { Component } from "solid-js";

import styles from "~/App.module.css";
import { OpponentCaptures, PlayerCaptures } from "~/components/CapturedPieces";
import { ChessBoard } from "~/components/ChessBoard";
import { Button } from "~/components/common/Button";
import { Label } from "~/components/common/Label";
import { GameHistoryFilters } from "~/components/GameHistoryFilters";
import { GameHistoryList } from "~/components/GameHistoryList";
import { MobileDrawer } from "~/components/MobileDrawer";
import { MoveList } from "~/components/MoveList";
import { Sidebar } from "~/components/Sidebar";
import { resolveAnnotations } from "~/engine/moveAnnotations";
import { useBlunderArrow } from "~/hooks/useBlunderArrow";
import { useGameAnalysis } from "~/hooks/useGameAnalysis";
import { useGameHistoryFilters } from "~/hooks/useGameHistoryFilters";
import { REVIEW_CAPABILITIES, setCapabilities } from "~/store/capabilitiesStore";
import { gameHistory, getGameById } from "~/store/gameHistoryStore";
import { loadGame } from "~/store/gameStore";
import {
  imLost,
  opponentIdentity,
  playerIdentity,
  setImLost,
  setOpponentIdentity,
  setPlayerIdentity,
} from "~/store/settingsStore";

export const ReviewScreen: Component = () => {
  const params = useParams<{ id?: string }>();
  const filters = useGameHistoryFilters();

  let prevPlayerIdentity = playerIdentity();
  let prevOpponentIdentity = opponentIdentity();
  let prevImLost = imLost();

  const activeGame = createMemo(() => {
    const id = params.id;
    if (!id) return null;
    void gameHistory();
    return getGameById(id);
  });

  const gameAnalysis = useGameAnalysis(activeGame);
  const annotations = createMemo(() => {
    const g = activeGame();
    if (!g) return [];
    const a = gameAnalysis();
    return resolveAnnotations(g.moves, a.cpDeltas, a.wasBestMoves, a.bestMoveUcis);
  });

  useBlunderArrow(annotations, () => gameAnalysis().bestMoveUcis);

  createEffect(() => {
    setCapabilities(
      activeGame() ? { ...REVIEW_CAPABILITIES, historyNav: true } : REVIEW_CAPABILITIES,
    );
  });

  createEffect(
    on(
      () => params.id,
      (id) => {
        if (!id) return;
        const g = getGameById(id);
        if (!g) return;

        prevPlayerIdentity = playerIdentity();
        prevOpponentIdentity = opponentIdentity();
        prevImLost = imLost();

        if (g.playerRace) setPlayerIdentity(g.playerRace);
        if (g.opponentRace) setOpponentIdentity(g.opponentRace);
        setImLost(false);

        try {
          loadGame({ pgn: g.pgn, startingFen: g.startingFen });
        } catch (err) {
          console.error("Failed to load saved game", err);
        }
      },
      { defer: false },
    ),
  );

  onCleanup(() => {
    setPlayerIdentity(prevPlayerIdentity);
    setOpponentIdentity(prevOpponentIdentity);
    setImLost(prevImLost);
  });

  return (
    <div class={styles["app-container"]}>
      <Show
        when={activeGame()}
        fallback={
          <>
            <div class={styles["sidebar-inset"]}>
              <GameHistoryFilters
                colorFilter={filters.colorFilter()}
                setColorFilter={filters.setColorFilter}
                firstMoveFilter={filters.firstMoveFilter()}
                setFirstMoveFilter={filters.setFirstMoveFilter}
                availableFirstMoves={filters.availableFirstMoves()}
                totalPages={filters.totalPages()}
                activePage={filters.activePage()}
                currentDateLabel={filters.currentDateLabel()}
                goToPrev={filters.goToPrev}
                goToNext={filters.goToNext}
              />
            </div>
            <div class={styles["board-area"]}>
              <GameHistoryList games={filters.visibleGames()} activeId={params.id} />
              <Sidebar />
            </div>
            <div class={styles.footer}>
              <div
                style={{
                  color: "rgba(255,255,255,0.6)",
                  padding: "2rem",
                  "text-align": "center",
                  display: "flex",
                  "flex-direction": "column",
                  "align-items": "center",
                  gap: "1rem",
                }}
              >
                <span>
                  {params.id ? "Game not found. Pick one above." : "Pick a game above to review."}
                </span>
                <Button primary href="/">
                  Back to Main Menu
                </Button>
              </div>
            </div>
          </>
        }
      >
        {(g) => {
          const resultLabel =
            g().result === "ongoing"
              ? "In Progress"
              : g().result.charAt(0).toUpperCase() + g().result.slice(1);
          const colorLabel = g().playerColor === "w" ? "White" : "Black";
          const resultColor = g().result === "ongoing" ? undefined : g().result;

          return (
            <>
              <div class={`${styles["sidebar-inset"]} mobile-nav-clear`}>
                <Label variant="title" color={resultColor}>
                  {resultLabel} ({colorLabel})
                </Label>
                <Label variant="title">vs {g().opponentName}</Label>
                <Button primary href="/review">
                  Back to recent games
                </Button>
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
                <MoveList game={g()} />
              </div>
            </>
          );
        }}
      </Show>

      <MobileDrawer />
    </div>
  );
};
