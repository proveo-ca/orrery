import type { Component } from 'solid-js';
import type { Square, PieceSymbol, Color } from 'chess.js';
import type { MoveSquares } from '../store/gameStore';

interface ChessSquareProps {
  square: Square;
  piece: { type: PieceSymbol; color: Color } | null;
  isLight: boolean;
  isSelected: boolean;
  isHovered: boolean;
  isValidMove: boolean;
  isAdviceHovered: boolean;
  isInvalid: boolean;
  showRank: string | false;
  showFile: string | false;
  onClick: () => void;
  onMouseEnter: () => void;
  lastMove: MoveSquares | null;
  activeColor: 'w' | 'b';
  isCheck: boolean;
  isCheckmate: boolean;
  isStalemate: boolean;
}

const getPieceImg = (type: PieceSymbol, color: Color) => {
  const piece = type.toUpperCase();
  return `https://raw.githubusercontent.com/lichess-org/lila/master/public/piece/cburnett/${color}${piece}.svg`;
};

export const ChessSquare: Component<ChessSquareProps> = (props) => {
  const isCapture = () => props.isValidMove && !!props.piece;
  const isLastMove = () => props.lastMove?.from === props.square || props.lastMove?.to === props.square;

  return (
    <div
      classList={{
        square: true,
        light: props.isLight,
        dark: !props.isLight,
        selected: props.isSelected,
        'valid-move': props.isValidMove && !isCapture(),
        capture: isCapture(),
        hovered: props.isHovered && !props.isInvalid,
        invalid: props.isInvalid,
        'advice-highlight': props.isAdviceHovered,
        'has-piece': !!props.piece,
        'in-check': props.isCheck,
        'in-checkmate': props.isCheckmate,
        'in-stalemate': props.isStalemate
      }}
      onClick={props.onClick}
      onMouseEnter={props.onMouseEnter}
    >
      {props.showRank && <span class="coordinate rank-label">{props.showRank}</span>}
      {props.showFile && <span class="coordinate file-label">{props.showFile}</span>}

      {isLastMove() && <div class="last-move-indicator"></div>}

      {props.piece && (
        <img
          src={getPieceImg(props.piece.type, props.piece.color)}
          alt={`${props.piece.color} ${props.piece.type}`}
          class="piece"
          draggable="false"
        />
      )}
    </div>
  );
};
