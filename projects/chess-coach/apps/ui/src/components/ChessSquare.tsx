import type { Color, PieceSymbol, Square } from "chess.js";
import clsx from "clsx";
import type { Component } from "solid-js";

import styles from "~/components/ChessBoard.module.css";
import type { MoveSquares } from "~/store/gameStore";

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
  onDragStart: (e: DragEvent) => void;
  onDragEnter: (e: DragEvent) => void;
  onDragOver: (e: DragEvent) => void;
  onDrop: (e: DragEvent) => void;
  lastMove: MoveSquares | null;
  isCheck: boolean;
  isCheckmate: boolean;
  isStalemate: boolean;
}

const getPieceImg = (type: PieceSymbol, color: Color) => {
  const piece = type.toUpperCase();
  return `/chess/pieces/cburnett/${color}${piece}.svg`;
};

export const ChessSquare: Component<ChessSquareProps> = (props) => {
  const isCapture = () => props.isValidMove && !!props.piece;
  const isLastMove = () =>
    props.lastMove?.from === props.square || props.lastMove?.to === props.square;

  return (
    <div
      classList={{
        [styles.square]: true,
        [styles.light]: props.isLight,
        [styles.dark]: !props.isLight,
        [styles.selected]: props.isSelected,
        [styles["valid-move"]]: props.isValidMove && !isCapture(),
        [styles.capture]: isCapture(),
        [styles.hovered]: props.isHovered && !props.isInvalid,
        [styles.invalid]: props.isInvalid,
        [styles["advice-highlight"]]: props.isAdviceHovered,
        [styles["has-piece"]]: !!props.piece,
        [styles["in-check"]]: props.isCheck,
        [styles["in-checkmate"]]: props.isCheckmate,
        [styles["in-stalemate"]]: props.isStalemate,
      }}
      onClick={props.onClick}
      onMouseEnter={props.onMouseEnter}
      onDragEnter={props.onDragEnter}
      onDragOver={props.onDragOver}
      onDrop={props.onDrop}
    >
      {props.showRank && (
        <span class={clsx(styles.coordinate, styles["rank-label"])}>{props.showRank}</span>
      )}
      {props.showFile && (
        <span class={clsx(styles.coordinate, styles["file-label"])}>{props.showFile}</span>
      )}

      {isLastMove() && <div class={styles["last-move-indicator"]}></div>}

      {props.piece && (
        <img
          src={getPieceImg(props.piece.type, props.piece.color)}
          alt={`${props.piece.color} ${props.piece.type}`}
          class={styles.piece}
          draggable="true"
          onDragStart={props.onDragStart}
        />
      )}
    </div>
  );
};
