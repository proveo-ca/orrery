// SPEC: _spec/chess-coach/ui/components.puml
import type { Color, PieceSymbol, Square } from "chess.js";
import { For, Show, createSignal } from "solid-js";
import type { Component } from "solid-js";

import { ChessSquare } from "~/components/atoms/ChessSquare";
import { DrawBubbles } from "~/components/features/DrawBubbles";
import styles from "~/components/features/MultiplayerBoard.module.css";
import { PromotionModal } from "~/components/primitives/PromotionModal";
import { useMultiplayerBoard } from "~/hooks/useMultiplayerBoard";
import { capabilities } from "~/store/capabilitiesStore";
import { activePlayerColor, opponentPieceSet, playerPieceSet } from "~/store/settingsStore";

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];
const RANKS = ["8", "7", "6", "5", "4", "3", "2", "1"];

const getPieceImg = (type: PieceSymbol, color: Color, pieceSet: string) =>
  `/chess/pieces/${pieceSet}/${color}${type.toUpperCase()}.svg`;

const squareFromTouch = (touch: Touch): Square | null => {
  const el = document.elementFromPoint(touch.clientX, touch.clientY);
  return ((el?.closest("[data-square]") as HTMLElement | null)?.dataset.square as Square) ?? null;
};

/**
 * Chessboard for LAN multiplayer — pure board interaction (select / move /
 * promote / drag, mouse + touch). No engine, eval bar, advice arrows, or coach
 * overlays: this screen is human-vs-human only. The Coach/Analysis/Review board
 * is the separate, engine-backed {@link ChessBoard}.
 */
interface MultiplayerBoardProps {
  onDrawBubbleClick?: () => void;
}

export const MultiplayerBoard: Component<MultiplayerBoardProps> = (props) => {
  const board = useMultiplayerBoard();

  const displayRanks = () => (activePlayerColor() === "w" ? RANKS : [...RANKS].reverse());
  const displayFiles = () => (activePlayerColor() === "w" ? FILES : [...FILES].reverse());

  const game = () => board.game();
  const isCheck = () => game().inCheck();
  const isCheckmate = () => game().isCheckmate();
  const isStalemate = () => game().isStalemate();
  const turn = () => game().turn();

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
    if (!sq || capabilities().readOnly || board.isReplaying()) return;

    const g = game();
    const piece = g.get(sq);
    if (!piece) return;

    const canTouch = g.turn() === activePlayerColor() && piece.color === activePlayerColor();
    if (!canTouch) return;

    e.preventDefault();
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

    if (target && target !== touchDrag()!.from) board.handleSquareClick(target);

    setTouchDrag(null);
    lastTouchSquare = null;
    board.handleBoardMouseLeave();
  };

  return (
    <div class={styles["board-layout-wrapper"]}>
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
                  const piece = () => game().get(square);

                  const isInvalid = () => {
                    if (board.hoveredSquare() !== square) return false;
                    const selected = board.selectedSquare();
                    if (selected) {
                      return !board.validMoves().includes(square) && square !== selected;
                    }
                    const p = piece();
                    if (!p) return false;
                    return p.color !== activePlayerColor() || game().turn() !== activePlayerColor();
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
                      isAdviceHovered={false}
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
                      lastMove={board.lastMove()}
                      animationQueue={board.animationQueue()}
                      consumeAnimation={board.consumeAnimation}
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

          <DrawBubbles onOfferClick={props.onDrawBubbleClick} />

          <PromotionModal
            pending={board.pendingPromotion()}
            onSelect={board.resolvePromotion}
            onCancel={board.cancelPromotion}
          />
        </div>
      </div>
    </div>
  );
};
