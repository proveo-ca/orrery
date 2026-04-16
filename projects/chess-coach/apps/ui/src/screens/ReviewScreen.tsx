import { useParams } from "@solidjs/router";
import { Show, createEffect, createMemo, on, onCleanup, onMount } from "solid-js";
import type { Component } from "solid-js";

import styles from "~/App.module.css";
import { OpponentCaptures, PlayerCaptures } from "~/components/CapturedPieces";
import { ChessBoard } from "~/components/ChessBoard";
import { Button } from "~/components/common/Button";
import { GameHistoryList } from "~/components/GameHistoryList";
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

  onMount(() => {
    setCapabilities(REVIEW_CAPABILITIES);
    document.getElementById("root")?.classList.add(styles["analysis-padding"]);
  });
  onCleanup(() => {
    document.getElementById("root")?.classList.remove(styles["analysis-padding"]);
  });

  const activeGame = createMemo(() => {
    const id = params.id;
    if (!id) return null;
    // Depend on gameHistory() so the memo refreshes when the list changes.
    void gameHistory();
    return getGameById(id);
  });

  // Replay the selected game into gameStore *only* when the route's id
  // actually changes. Using `on(() => params.id, ...)` with an explicit id
  // dependency prevents re-firing when getGameById's internal store reads
  // re-subscribe and cause a reactive ripple on every navigation click.
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
    ),
  );

  return (
    <div class={styles["app-container"]}>
      <GameHistoryList activeId={params.id} />

      <Show
        when={activeGame()}
        fallback={
          <div style={{ color: "rgba(255,255,255,0.6)", padding: "2rem", "text-align": "center", display: "flex", "flex-direction": "column", "align-items": "center", gap: "1rem" }}>
            <span>{params.id ? "Game not found. Pick one above." : "Pick a game above to review."}</span>
            <Button href="/">Back to Main Menu</Button>
          </div>
        }
      >
        {(g) => (
          <>
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
