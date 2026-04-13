import type { Square } from "chess.js";
import { For, Show } from "solid-js";
import type { Component } from "solid-js";

import styles from "~/components/ChessBoard.module.css";
import { ChessSquare } from "~/components/ChessSquare";
import { Button } from "~/components/common/Button";
import { Modal } from "~/components/common/Modal";
import { EvalBar } from "~/components/EvalBar";
import { useChessBoard } from "~/hooks/useChessBoard";
import { adviceHoveredSquares, setShowNewGame } from "~/store/coachStore";
import {
  activePlayerColor,
  opponentPieceSet,
  playerPieceSet,
} from "~/store/settingsStore";
import { isTravelling } from "~/store/travelStore";

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];
const RANKS = ["8", "7", "6", "5", "4", "3", "2", "1"];

export const ChessBoard: Component = () => {
  const board = useChessBoard();

  const displayRanks = () => (activePlayerColor() === "w" ? RANKS : [...RANKS].reverse());
  const displayFiles = () => (activePlayerColor() === "w" ? FILES : [...FILES].reverse());

  const activeGame = () => board.activeGame();
  const lastMove = () => board.lastMove();

  const isCheck = () => activeGame().inCheck();
  const isCheckmate = () => activeGame().isCheckmate();
  const isStalemate = () => activeGame().isStalemate();
  const isGameOver = () => !isTravelling() && activeGame().isGameOver();
  const turn = () => activeGame().turn();

  return (
    <div class={styles["board-layout-wrapper"]}>
      <Show when={board.isReplaying()}>
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
        <div class={styles.chessboard}>
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

          <Modal
            open={isGameOver()}
            position="absolute"
            dismissible={false}
            showCloseButton={false}
            overlayClass={styles["game-over-overlay"]}
            contentClass={styles["game-over-banner"]}
          >
            <div class={styles.result}>
              {isCheckmate() ? "Checkmate" : isStalemate() ? "Stalemate" : "Draw"}
            </div>
            <Button onClick={() => setShowNewGame(true)}>Another game?</Button>
          </Modal>
        </div>
      </div>
    </div>
  );
};
