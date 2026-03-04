import { For } from 'solid-js';
import type { Component } from 'solid-js';
import type { Square } from 'chess.js';
import { adviceHoveredSquares } from '../store/coachState';
import { isTravelling } from '../store/travelState';
import { activePlayerColor } from '../store/settingsState';
import { useChessBoard } from '../hooks/useChessBoard';
import { Modal } from './common/Modal';
import { ChessSquare } from './ChessSquare';
import './ChessBoard.css';

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const RANKS = ['8', '7', '6', '5', '4', '3', '2', '1'];

export const BoardWrapper: Component = () => {
  const board = useChessBoard();

  const displayRanks = () => activePlayerColor() === 'w' ? RANKS : [...RANKS].reverse();
  const displayFiles = () => activePlayerColor() === 'w' ? FILES : [...FILES].reverse();

  const activeGame = () => board.activeGame();
  const lastMove = () => board.lastMove();

  const isCheck = () => activeGame().inCheck();
  const isCheckmate = () => activeGame().isCheckmate();
  const isStalemate = () => activeGame().isStalemate();
  const isGameOver = () => !isTravelling() && activeGame().isGameOver();
  const turn = () => activeGame().turn();

  return (
    <div 
      class="chessboard-container"
      onMouseEnter={board.handleBoardMouseEnter}
      onMouseLeave={board.handleBoardMouseLeave}
    >
      <div class="chessboard">
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
                    return p.color !== activePlayerColor() || board.game().turn() !== activePlayerColor();
                  }
                };

                return (
                  <ChessSquare
                    square={square}
                    piece={piece() ?? null}
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
                    lastMove={lastMove()}
                    isCheck={piece()?.type === 'k' && piece()?.color === turn() && isCheck() && !isCheckmate()}
                    isCheckmate={piece()?.type === 'k' && piece()?.color === turn() && isCheckmate()}
                    isStalemate={piece()?.type === 'k' && piece()?.color === turn() && isStalemate()}
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
          overlayClass="game-over-overlay"
          contentClass="game-over-banner"
        >
          <div>{isCheckmate() ? 'Checkmate' : isStalemate() ? 'Stalemate' : 'Draw'}</div>
        </Modal>
      </div>
    </div>
  );
};
