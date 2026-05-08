import { useParams } from "@solidjs/router";
import { Show, createEffect, createMemo, on } from "solid-js";
import type { Component } from "solid-js";

import styles from "~/App.module.css";
import { OpponentCaptures, PlayerCaptures } from "~/components/CapturedPieces";
import { ChessBoard } from "~/components/ChessBoard";
import { Button } from "~/components/common/Button";
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

/**
 * Read-only review of a saved game. URL: `/chess/review/:id` where id is the
 * Polyglot-Zobrist game hash. Shows the 10-game history at the top, the
 * board in the middle (interaction disabled via REVIEW_CAPABILITIES.readOnly),
 * and the annotated move list in the footer slot.
 */
export const ReviewScreen: Component = () => {
  const params = useParams<{ id?: string }>();
  const filters = useGameHistoryFilters();

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

  // Blunder arrows are a board-level effect and should only run in ReviewScreen
  useBlunderArrow(annotations, () => gameAnalysis().bestMoveUcis);

  // Capabilities track whether a game is active.
  createEffect(() => {
    setCapabilities(
      activeGame() ? { ...REVIEW_CAPABILITIES, historyNav: true } : REVIEW_CAPABILITIES,
    );
  });

  // Load the selected game into the game store.
  // defer: false so it runs on initial mount (not just on subsequent changes).
  createEffect(
    on(
      () => params.id,
      (id) => {
        if (!id) return;
        const g = getGameById(id);
        if (!g) return;
        try {
          loadGame({ pgn: g.pgn, startingFen: g.startingFen });
        } catch (err) {
          console.error("Failed to load saved game", err);
        }
      },
      { defer: false },
    ),
  );

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
        {(g) => (
          <>
            <div class={`${styles["sidebar-inset"]} mobile-nav-clear`}>
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
        )}
      </Show>

      <MobileDrawer />
    </div>
  );
};
