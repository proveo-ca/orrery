// SPEC: _spec/chess-coach/ui/components.puml
import { useParams } from "@solidjs/router";
import { Show, createEffect, createMemo, on } from "solid-js";
import type { Component } from "solid-js";

import styles from "~/App.module.css";
import { OpponentCaptures, PlayerCaptures } from "~/components/CapturedPieces";
import { ChessBoard } from "~/components/ChessBoard";
import { Button } from "~/components/common/Button";
import { GameHistoryList } from "~/components/GameHistoryList";
import { GameHistoryFilters } from "~/components/GameHistoryFilters";
import { MobileDrawer } from "~/components/MobileDrawer";
import { MoveList } from "~/components/MoveList";
import { Sidebar } from "~/components/Sidebar";
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

  const activeGame = createMemo(() => {
    const id = params.id;
    if (!id) return null;
    void gameHistory();
    return getGameById(id);
  });

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
            <div class={styles["board-area"]}>
              <GameHistoryFilters colorFilter={} setColorFilter={} firstMoveFilter={} setFirstMoveFilter={} availableFirstMoves={} totalPages={} activePage={} currentDateLabel={} goToPrev={} goToNext={} />
              <GameHistoryList activeId={params.id} />
              <Sidebar />
            </div>
            <div class={styles.footer}>
              <div style={{ color: "rgba(255,255,255,0.6)", padding: "2rem", "text-align": "center", display: "flex", "flex-direction": "column", "align-items": "center", gap: "1rem" }}>
                <span>{params.id ? "Game not found. Pick one above." : "Pick a game above to review."}</span>
                <Button href="/">Back to Main Menu</Button>
              </div>
            </div>
          </>
        }
      >
        {(g) => (
          <>
            <div class={`${styles["sidebar-inset"]} mobile-nav-clear`}>
              <Button href="/review">Back to recent games</Button>
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
