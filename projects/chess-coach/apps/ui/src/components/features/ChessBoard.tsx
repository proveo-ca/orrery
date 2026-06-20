// SPEC: _spec/chess-coach/ui/components.puml
import type { MoveSquares } from "~/types/game";
import type { Color, PieceSymbol, Square } from "chess.js";
import { For, Show, createEffect, createSignal } from "solid-js";
import type { Component } from "solid-js";

import styles from "~/components/features/ChessBoard.module.css";
import { ChessBoardArrow } from "~/components/atoms/ChessBoardArrow.tsx";
import { ChessSquare } from "~/components/atoms/ChessSquare";
import { Button } from "~/components/primitives/Button.tsx";
import { Modal } from "~/components/atoms/Modal.tsx";
import { EvalBar } from "~/components/primitives/EvalBar";
import { PromotionModal } from "~/components/primitives/PromotionModal";
import { useChessBoard } from "~/hooks/useChessBoard";
import { capabilities } from "~/store/capabilitiesStore";
import { adviceArrow, adviceHoveredSquares, setShowNewGame } from "~/store/coachStore";
import { getExpectedReviewId, hasRecordedReview } from "~/store/gameHistoryStore.ts";
import { currentIndex, fenHistory, game, isResigned, startingFen } from "~/store/gameStore";
import { activePlayerColor, opponentPieceSet, playerPieceSet } from "~/store/settingsStore";
import { isTravelling } from "~/store/travelStore";

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];
const RANKS = ["8", "7", "6", "5", "4", "3", "2", "1"];

const getPieceImg = (type: PieceSymbol, color: Color, pieceSet: string) =>
  `/chess/pieces/${pieceSet}/${color}${type.toUpperCase()}.svg`;

const squareFromTouch = (touch: Touch): Square | null => {
  const el = document.elementFromPoint(touch.clientX, touch.clientY);
  return ((el?.closest("[data-square]") as HTMLElement | null)?.dataset.square as Square) ?? null;
};

export const ChessBoard: Component = () => {
  const board = useChessBoard();

  const displayRanks = () => (activePlayerColor() === "w" ? RANKS : [...RANKS].reverse());
  const displayFiles = () => (activePlayerColor() === "w" ? FILES : [...FILES].reverse());

  const activeGame = () => board.activeGame();
  const lastMove = () => board.lastMove();
  const animationQueue = () => board.animationQueue();
  const consumeAnimation = (m: MoveSquares) => board.consumeAnimation?.(m);

  const isCheck = () => activeGame().inCheck();
  const isCheckmate = () => activeGame().isCheckmate();
  const isStalemate = () => activeGame().isStalemate();
  const turn = () => activeGame().turn();

  // ── Touch-drag (mobile) ──────────────────────────────────────────────
  const [touchDrag, setTouchDrag] = createSignal<{
    from: Square;
    piece: { type: PieceSymbol; color: Color };
    pieceSet: string;
    x: number;
    y: number;
  } | null>(null);
  let lastTouchSquare: Square | null = null;

  const handleTouchStart = (e: TouchEvent) => {
    const touch = e.touches[0];
    if (!touch) return;
    const sq = squareFromTouch(touch);
    if (!sq || board.isReplaying() || capabilities().readOnly) return;

    const g = board.game();
    const piece = g.get(sq);
    if (!piece) return;

    const canTouch = capabilities().freeColorControl
      ? piece.color === g.turn()
      : g.turn() === activePlayerColor() && piece.color === activePlayerColor();
    if (!canTouch) return;

    e.preventDefault();

    // Select the piece (sets selectedSquare + validMoves inside the hook)
    board.handleSquareClick(sq);

    const pSet = piece.color === activePlayerColor() ? playerPieceSet() : opponentPieceSet();
    setTouchDrag({ from: sq, piece, pieceSet: pSet, x: touch.clientX, y: touch.clientY });
    lastTouchSquare = sq;
  };

  const handleTouchMove = (e: TouchEvent) => {
    if (!touchDrag()) return;
    e.preventDefault();
    const touch = e.touches[0];
    if (!touch) return;

    setTouchDrag((prev) => (prev ? { ...prev, x: touch.clientX, y: touch.clientY } : null));

    const sq = squareFromTouch(touch);
    if (sq && sq !== lastTouchSquare) {
      board.handleSquareHover(sq);
      lastTouchSquare = sq;
    }
  };

  const handleTouchEnd = (e: TouchEvent) => {
    if (!touchDrag()) return;
    const touch = e.changedTouches[0];
    const target = touch ? squareFromTouch(touch) : null;

    if (target && target !== touchDrag()!.from) {
      board.handleSquareClick(target);
    }

    setTouchDrag(null);
    lastTouchSquare = null;
    board.handleBoardMouseLeave();
  };

  // Cancel any in-flight touch drag when the board enters replay or travel
  // — the piece snaps back to its original square.
  createEffect(() => {
    if ((board.isReplaying() || isTravelling()) && touchDrag()) {
      setTouchDrag(null);
      lastTouchSquare = null;
    }
  });
  const isReplaying = () => currentIndex() < fenHistory().length - 1;
  // End-game banner is shown only in the final game state — never while
  // replaying a past move or time-travelling. `game()` is the authoritative
  // live instance, so checkmate/stalemate read the true terminal position.
  const isGameOver = () =>
    !isReplaying() && !isTravelling() && (game().isGameOver() || isResigned());

  return (
    <div class={styles["board-layout-wrapper"]}>
      <Show when={board.isReplaying() || capabilities().evalBarAlwaysVisible}>
        <EvalBar
          score={board.baseEvalScore()}
          isFlipped={activePlayerColor() === "b"}
          turn={turn()}
        />
      </Show>
      <div
        class={styles["chessboard-container"]}
        onMouseEnter={board.handleBoardMouseEnter}
        onMouseLeave={board.handleBoardMouseLeave}
      >
        <div
          class={styles.chessboard}
          onContextMenu={(e) => e.preventDefault()}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <For each={displayRanks()}>
            {(rank, rIndex) => (
              <For each={displayFiles()}>
                {(file, fIndex) => {
                  const square = `${file}${rank}` as Square;
                  const piece = () => activeGame().get(square);

                  const isInvalid = () => {
                    if (board.hoveredSquare() !== square) return false;
                    const selected = board.selectedSquare();
                    if (selected) {
                      return !board.validMoves().includes(square) && square !== selected;
                    } else {
                      const p = piece();
                      if (!p) return false;
                      return (
                        p.color !== activePlayerColor() ||
                        board.game().turn() !== activePlayerColor()
                      );
                    }
                  };

                  const squarePieceSet = () => {
                    const p = piece();
                    if (!p) return playerPieceSet();
                    return p.color === activePlayerColor() ? playerPieceSet() : opponentPieceSet();
                  };

                  return (
                    <ChessSquare
                      square={square}
                      piece={piece() ?? null}
                      pieceSet={squarePieceSet()}
                      isLight={(rIndex() + fIndex()) % 2 === 0}
                      isSelected={board.selectedSquare() === square}
                      isHovered={board.hoveredSquare() === square}
                      isValidMove={board.validMoves().includes(square)}
                      isAdviceHovered={adviceHoveredSquares().includes(square)}
                      isDragging={touchDrag()?.from === square}
                      isInvalid={isInvalid()}
                      showRank={fIndex() === 0 && rank}
                      showFile={rIndex() === 7 && file}
                      onClick={() => board.handleSquareClick(square)}
                      onMouseEnter={() => board.handleSquareHover(square)}
                      onDragStart={(e) => board.handleDragStart(square, e)}
                      onDragEnter={(e) => board.handleDragEnter(square, e)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => board.handleDrop(square, e)}
                      lastMove={lastMove()}
                      animationQueue={animationQueue()}
                      consumeAnimation={consumeAnimation}
                      flipped={activePlayerColor() === "b"}
                      isCheck={
                        piece()?.type === "k" &&
                        piece()?.color === turn() &&
                        isCheck() &&
                        !isCheckmate()
                      }
                      isCheckmate={
                        piece()?.type === "k" && piece()?.color === turn() && isCheckmate()
                      }
                      isStalemate={
                        piece()?.type === "k" && piece()?.color === turn() && isStalemate()
                      }
                    />
                  );
                }}
              </For>
            )}
          </For>

          <Show when={board.bestMoveArrow()}>
            {(arrow) => (
              <ChessBoardArrow
                from={arrow().from}
                to={arrow().to}
                color="#7dd17d"
                id="best-move-arrow-head"
              />
            )}
          </Show>

          <Show when={adviceArrow()}>
            {(arrow) => (
              <ChessBoardArrow
                from={arrow().from}
                to={arrow().to}
                color="#76b3e1"
                id="advice-arrow-head"
              />
            )}
          </Show>

          <Show when={touchDrag()}>
            {(drag) => (
              <img
                src={getPieceImg(drag().piece.type, drag().piece.color, drag().pieceSet)}
                alt=""
                class={styles["touch-ghost"]}
                style={{ left: `${drag().x}px`, top: `${drag().y}px` }}
              />
            )}
          </Show>

          <PromotionModal
            pending={board.pendingPromotion()}
            onSelect={board.resolvePromotion}
            onCancel={board.cancelPromotion}
          />
        </div>
      </div>
      <Modal
        open={isGameOver()}
        position="absolute"
        dismissible={false}
        showCloseButton={false}
        overlayClass={styles["game-over-overlay"]}
        contentClass={styles["game-over-banner"]}
      >
        <h1 class={styles.result}>
          {isResigned()
            ? "Resignation"
            : game().isCheckmate()
              ? "Checkmate"
              : game().isStalemate()
                ? "Stalemate"
                : "Draw"}
        </h1>
        <div class={styles["game-over-actions"]}>
          <Button primary onClick={() => setShowNewGame(true)}>
            Another Game
          </Button>
          <Show when={hasRecordedReview(game().pgn(), startingFen())}>
            <Button primary href={`/review/${getExpectedReviewId(game().pgn(), startingFen())}`}>
              Review Game
            </Button>
          </Show>
        </div>
      </Modal>
    </div>
  );
};
