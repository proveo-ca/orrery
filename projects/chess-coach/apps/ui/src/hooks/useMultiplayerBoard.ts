// SPEC: _spec/chess-coach/ui/components.puml
import { type Chess, type Color, type Square } from "chess.js";
import { createEffect, createMemo, createSignal } from "solid-js";

import { capabilities } from "~/store/capabilitiesStore";
import { addMove, currentIndex, game as latestGame, moveHistory } from "~/store/gameStore";
import { setLastLocalMove } from "~/store/roomStore";
import { activePlayerColor, opponentPieceSet, playerPieceSet } from "~/store/settingsStore";
import type { PromotionPiece } from "~/types/chess";
import type { MoveSquares } from "~/types/game";
import type { PieceSet } from "~/types/settings";
import { logger } from "~/utils/logger";

/**
 * Board interaction for LAN multiplayer: selection, legal-move highlighting,
 * click / drag / touch, and pawn promotion. Deliberately coach- and
 * engine-free — the LAN screen is pure human-vs-human, so there is no
 * Stockfish, no advice/emotions, no hint/blunder analysis here (unlike the
 * Coach board's {@link useChessBoard}). A completed local move is applied to
 * gameStore and announced via `setLastLocalMove`, which useMultiplayerGame
 * relays to the opponent.
 */
export function useMultiplayerBoard() {
  // equals:false — the authoritative Chess instance is mutated in place, so
  // reference equality would hide moves from SolidJS. currentIndex() makes it
  // re-run on every applied move (local or relayed).
  const game = createMemo(
    () => {
      currentIndex();
      return latestGame();
    },
    undefined,
    { equals: false },
  );

  const [selectedSquare, setSelectedSquare] = createSignal<Square | null>(null);
  const [hoveredSquare, setHoveredSquare] = createSignal<Square | null>(null);
  const [validMoves, setValidMoves] = createSignal<string[]>([]);

  const [pendingPromotion, setPendingPromotion] = createSignal<{
    color: Color;
    pieceSet: PieceSet;
    resolve: (piece: PromotionPiece | null) => void;
  } | null>(null);

  const requestPromotion = (color: Color, pieceSet: PieceSet) =>
    new Promise<PromotionPiece | null>((resolve) =>
      setPendingPromotion({ color, pieceSet, resolve }),
    );
  const resolvePromotion = (piece: PromotionPiece) => {
    const p = pendingPromotion();
    if (!p) return;
    p.resolve(piece);
    setPendingPromotion(null);
  };
  const cancelPromotion = () => {
    const p = pendingPromotion();
    if (!p) return;
    p.resolve(null);
    setPendingPromotion(null);
  };

  // A player may touch only their own pieces, only on their own turn.
  const canTouch = (g: Chess, sq: Square): boolean => {
    const piece = g.get(sq);
    return g.turn() === activePlayerColor() && piece?.color === activePlayerColor();
  };

  const clearSelection = () => {
    setSelectedSquare(null);
    setValidMoves([]);
  };

  /** Apply selected→target if legal; prompts for a promotion piece when needed. */
  const applyMove = async (g: Chess, from: Square, to: Square): Promise<boolean> => {
    const candidate = g.moves({ square: from, verbose: true }).find((m) => m.to === to);
    if (!candidate) return false;

    let promotion: PromotionPiece = "q";
    if (candidate.promotion) {
      const piece = g.get(from);
      if (!piece) return false;
      const pieceSet = piece.color === activePlayerColor() ? playerPieceSet() : opponentPieceSet();
      const choice = await requestPromotion(piece.color, pieceSet);
      if (!choice) return false; // promotion cancelled — keep selection
      promotion = choice;
    }

    try {
      const result = addMove({ from, to, promotion });
      setLastLocalMove({ san: result.san, fen: result.after });
      return true;
    } catch (e) {
      logger.error("LAN move failed", e);
      return false;
    }
  };

  const handleSquareClick = async (square: Square) => {
    if (capabilities().readOnly) return;
    const g = game();
    const selected = selectedSquare();

    if (selected === square) {
      clearSelection();
      setHoveredSquare(null);
      return;
    }

    if (selected) {
      const moved = await applyMove(g, selected, square);
      if (moved) {
        clearSelection();
        setHoveredSquare(null);
        return;
      }
      // Not a legal target — fall through to (re)selecting an own piece.
    }

    if (canTouch(g, square)) {
      setSelectedSquare(square);
      setValidMoves(g.moves({ square, verbose: true }).map((m) => m.to));
    } else {
      clearSelection();
    }
  };

  const handleSquareHover = (square: Square) => {
    if (capabilities().readOnly) return;
    setHoveredSquare(square);
  };

  const handleBoardMouseEnter = () => {};
  const handleBoardMouseLeave = () => setHoveredSquare(null);

  const handleDragStart = (square: Square, e: DragEvent) => {
    const g = game();
    if (capabilities().readOnly || !canTouch(g, square)) {
      e.preventDefault();
      return;
    }
    if (selectedSquare() !== square) {
      setSelectedSquare(square);
      setValidMoves(g.moves({ square, verbose: true }).map((m) => m.to));
    }
    e.dataTransfer?.setData("text/plain", square);
    if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
  };

  const handleDragEnter = (square: Square, e: DragEvent) => {
    e.preventDefault();
    handleSquareHover(square);
  };

  const handleDrop = async (square: Square, e: DragEvent) => {
    e.preventDefault();
    const source = e.dataTransfer?.getData("text/plain") as Square;
    if (!source || source === square) return;
    if (selectedSquare() === source) await handleSquareClick(square);
  };

  const lastMove = (): MoveSquares | null => {
    const idx = currentIndex();
    return idx > 0 ? (moveHistory()[idx - 1] ?? null) : null;
  };

  // Slide animation: enqueue the latest move whenever the position advances
  // (covers both the local player's moves and relayed opponent moves).
  const [animationQueue, setAnimationQueue] = createSignal<MoveSquares[]>([]);
  const consumeAnimation = (m: MoveSquares) =>
    setAnimationQueue((q) =>
      q.length && q[0].from === m.from && q[0].to === m.to ? q.slice(1) : q,
    );
  createEffect(() => {
    const idx = currentIndex();
    if (idx > 0) {
      const m = moveHistory()[idx - 1];
      if (m) setAnimationQueue((q) => [...q, m]);
    }
  });

  return {
    game,
    selectedSquare,
    hoveredSquare,
    validMoves,
    pendingPromotion,
    resolvePromotion,
    cancelPromotion,
    handleSquareClick,
    handleSquareHover,
    handleBoardMouseEnter,
    handleBoardMouseLeave,
    handleDragStart,
    handleDragEnter,
    handleDrop,
    lastMove,
    animationQueue,
    consumeAnimation,
  };
}
