import type { Color, PieceSymbol, Square } from "chess.js";
import clsx from "clsx";
import { createEffect, on } from "solid-js";
import type { Component } from "solid-js";

import styles from "~/components/atoms/ChessSquare.module.css";
// SPEC: _spec/chess-coach/ui/components.puml
import type { MoveSquares } from "~/types/game";
import type { PieceSet } from "~/types/settings";

/** Grid-square offset from `from` to `to`, accounting for board flip. */
function squareOffset(from: string, to: string, flipped: boolean): { dx: number; dy: number } {
  const fileDiff = from.charCodeAt(0) - to.charCodeAt(0);
  const rankDiff = Number(to[1]) - Number(from[1]);
  const sign = flipped ? -1 : 1;
  return { dx: sign * fileDiff, dy: sign * rankDiff };
}

interface ChessSquareProps {
  square: Square;
  piece: { type: PieceSymbol; color: Color } | null;
  pieceSet: PieceSet;
  isLight: boolean;
  isSelected: boolean;
  isHovered: boolean;
  isValidMove: boolean;
  isAdviceHovered: boolean;
  isDragging: boolean;
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
  animationQueue: MoveSquares[];
  consumeAnimation?: (m: MoveSquares) => void;
  flipped: boolean;
  isCheck: boolean;
  isCheckmate: boolean;
  isStalemate: boolean;
}

const getPieceImg = (type: PieceSymbol, color: Color, pieceSet: PieceSet) => {
  const piece = type.toUpperCase();
  return `/chess/pieces/${pieceSet}/${color}${piece}.svg`;
};

export const ChessSquare: Component<ChessSquareProps> = (props) => {
  const isCapture = () => props.isValidMove && !!props.piece;
  const isLastMove = () =>
    props.lastMove?.from === props.square || props.lastMove?.to === props.square;

  let pieceRef: HTMLImageElement | undefined;

  // Queue-driven animation: consumes the head of animationQueue when it targets
  // this square, ensuring rapid successive moves (human+AI) each get a visible slide.
  createEffect(
    on(
      () => props.animationQueue,
      (queue) => {
        if (!queue.length || !pieceRef || props.isDragging) return;
        const head = queue[0];
        if (!head || head.to !== props.square) return;
        // Consume immediately so the next queued move for any square can proceed
        props.consumeAnimation?.(head);
        const { dx, dy } = squareOffset(head.from, head.to, props.flipped);
        pieceRef.style.transition = "none";
        pieceRef.style.transform = `translate(${dx * 100}%, ${dy * 100}%)`;
        void pieceRef.offsetWidth;
        pieceRef.style.transition = "transform 150ms ease-out";
        pieceRef.style.transform = "translate(0, 0)";
      },
      { defer: true },
    ),
  );

  return (
    <div
      data-square={props.square}
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
        [styles.dragging]: props.isDragging,
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
          ref={pieceRef}
          src={getPieceImg(props.piece.type, props.piece.color, props.pieceSet)}
          alt={`${props.piece.color} ${props.piece.type}`}
          class={styles.piece}
          draggable="true"
          onDragStart={props.onDragStart}
        />
      )}
    </div>
  );
};
