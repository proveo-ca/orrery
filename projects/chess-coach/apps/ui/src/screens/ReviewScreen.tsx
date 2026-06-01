import { useNavigate, useParams } from "@solidjs/router";
import { Show, createEffect, createMemo, createSignal, on, onCleanup } from "solid-js";
import type { Component } from "solid-js";

import styles from "~/App.module.css";
import { OpponentCaptures, PlayerCaptures } from "~/components/CapturedPieces";
import { ChessBoard } from "~/components/ChessBoard";
import { Button } from "~/components/common/Button";
import { Label } from "~/components/common/Label";
import { MatrixOverlay } from "~/components/common/MatrixOverlay";
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
import {
  fenHistory,
  loadGame,
  reviewAnalysisMode,
  setSavedReviewBranchIndex,
  setReviewAnalysisMode,
  setSavedReviewPgn,
  setSavedReviewStartingFen,
} from "~/store/gameStore";
import {
  activePlayerColor,
  opponentIdentity,
  playerIdentity,
  setActivePlayerColor,
  setOpponentIdentity,
  setPlayerIdentity,
} from "~/store/settingsStore";

export const ReviewScreen: Component = () => {
  const params = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const filters = useGameHistoryFilters();

  let prevPlayerIdentity = playerIdentity();
  let prevOpponentIdentity = opponentIdentity();
  let prevActivePlayerColor = activePlayerColor();

  const [originalFenHistory, setOriginalFenHistory] = createSignal<string[]>([]);
  const [originalPlayerColor, setOriginalPlayerColor] = createSignal<"w" | "b">("w");
  const [analysisBranchPly, setAnalysisBranchPly] = createSignal<number | null>(null);

  // Branched analysis moves are scratch work, so the MoveList stays pinned
  // to the original move that produced the branch-off position.
  const branchIndexFrom = (current: string[], original: string[]) => {
    const firstMismatch = current.findIndex((fen, i) => fen !== original[i]);
    return Math.max(
      0,
      firstMismatch >= 0 ? firstMismatch - 1 : Math.min(current.length, original.length) - 1,
    );
  };

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
      activeGame()
        ? { ...REVIEW_CAPABILITIES, historyNav: true, freeColorControl: true }
        : REVIEW_CAPABILITIES,
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
        prevActivePlayerColor = activePlayerColor();

        if (g.playerRace) setPlayerIdentity(g.playerRace);
        if (g.opponentRace) setOpponentIdentity(g.opponentRace);
        setActivePlayerColor(g.playerColor);

        setOriginalPlayerColor(g.playerColor);
        setReviewAnalysisMode(false);
        setAnalysisBranchPly(null);
        setSavedReviewBranchIndex(0);

        try {
          loadGame({ pgn: g.pgn, startingFen: g.startingFen });
          setOriginalFenHistory([...fenHistory()]);
        } catch (err) {
          console.error("Failed to load saved game", err);
          setOriginalFenHistory([]);
        }
      },
      { defer: false },
    ),
  );

  createEffect(() => {
    const orig = originalFenHistory();
    if (activeGame() && orig.length > 0) {
      const current = fenHistory();
      const diverged =
        current.length !== orig.length ||
        current.some((fen, i) => fen !== orig[i]);
      if (diverged) {
        if (analysisBranchPly() == null) {
          const branchIndex = branchIndexFrom(current, orig);
          setAnalysisBranchPly(branchIndex - 1);
          setSavedReviewBranchIndex(branchIndex);
        }
        setReviewAnalysisMode(true);
        const g = activeGame()!;
        setSavedReviewPgn(g.pgn);
        setSavedReviewStartingFen(g.startingFen);
        setActivePlayerColor(originalPlayerColor());
        return;
      }
    }
    setAnalysisBranchPly(null);
    setSavedReviewBranchIndex(0);
    setReviewAnalysisMode(false);
  });

  onCleanup(() => {
    setReviewAnalysisMode(false);
    setAnalysisBranchPly(null);
    setSavedReviewBranchIndex(0);
    setPlayerIdentity(prevPlayerIdentity);
    setOpponentIdentity(prevOpponentIdentity);
    setActivePlayerColor(prevActivePlayerColor);
  });

  return (
    <div classList={{ [styles["app-container"]]: true, highlight: reviewAnalysisMode() }}>
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
                <Button primary onClick={() => navigate(-1)}>
                  Back
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
                <MoveList game={g()} activePly={analysisBranchPly()} analysis={gameAnalysis()} />
              </div>
            </>
          );
        }}
      </Show>

      <Show when={reviewAnalysisMode()}>
        <MatrixOverlay density={60} speed={0.9} />
      </Show>

      <MobileDrawer />
    </div>
  );
};
