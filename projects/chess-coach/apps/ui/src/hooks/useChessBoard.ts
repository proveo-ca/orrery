import { Chess, type Square } from "chess.js";
import { createEffect, createMemo, createSignal, onCleanup } from "solid-js";

import { type HoverEval, useHoverEvaluator } from "~/hooks/useHoverEvaluator";
import { useMoveExecutor } from "~/hooks/useMoveExecutor";
import { useStockfishWorker } from "~/hooks/useStockfishWorker";
import {
  type CoachEmotion,
  baseAdvice,
  baseCoachEmotion,
  clearHoverOverride,
  setHoverAdvice,
  setHoverEmotion,
} from "~/store/coachStore";
import { currentFen, currentIndex, fenHistory, moveHistory } from "~/store/gameStore";
import { activePlayerColor } from "~/store/settingsStore";
import { isTravelling, travelFen, travelIndex, travelMoveHistory } from "~/store/travelStore";
import { logger } from "~/utils/logger";

export function useChessBoard() {
  const game = createMemo(() => new Chess(currentFen()));
  const [selectedSquare, setSelectedSquare] = createSignal<Square | null>(null);
  const [hoveredSquare, setHoveredSquare] = createSignal<Square | null>(null);
  const [validMoves, setValidMoves] = createSignal<string[]>([]);
  const { send, analysis } = useStockfishWorker("/stockfish-18-lite.js");
  const moveExecutor = useMoveExecutor(() => send("stop"));

  const isReplaying = () => isTravelling() || currentIndex() < fenHistory().length - 1;

  let evalTimeout: number | undefined;
  let hoverEvalSeq = 0;
  const [currentHoverEval, setCurrentHoverEval] = createSignal<HoverEval | null>(null);
  const [humanBestMove, setHumanBestMove] = createSignal<string | null>(null);
  const [baseEvalScore, setBaseEvalScore] = createSignal<{
    kind: "cp" | "mate";
    value: number;
  } | null>(null);

  const resumeBaseAnalysis = () => {
    const g = activeGame();
    if (!g.isGameOver() && (g.turn() === activePlayerColor() || isReplaying())) {
      send(`position fen ${g.fen()}`);
      send("go depth 12");
    }
  };

  const canApplyHoverOverride = () => {
    const base = baseCoachEmotion();
    return (
      base === "idle" ||
      base === "watching" ||
      base === "watching--left" ||
      base === "watching--right"
    );
  };

  const applyHoverBaseline = (square?: Square) => {
    if (!canApplyHoverOverride()) return;

    let emotion: CoachEmotion = "watching";
    if (square) {
      const file = square[0];
      const isFlipped = activePlayerColor() === "b";

      // If board is flipped, 'g'/'h' are on the left, 'a'/'b' are on the right
      const isLeftScreen = isFlipped ? file === "g" || file === "h" : file === "a" || file === "b";
      const isRightScreen = isFlipped ? file === "a" || file === "b" : file === "g" || file === "h";

      if (isLeftScreen) emotion = "watching--left";
      else if (isRightScreen) emotion = "watching--right";
    }

    setHoverEmotion(emotion);

    // Hover always overrides advice; baseline override matches current base advice
    // so the UI doesn't "jump" until we have something meaningful to say.
    setHoverAdvice(baseAdvice());
  };

  createEffect(() => {
    // If the base coach state becomes something "active" (thinking/happy/shocked/sleepy/etc),
    // ensure hover doesn't mask it.
    if (!canApplyHoverOverride() && !isTravelling()) {
      clearHoverOverride();
      setCurrentHoverEval(null);
      send("stop");
    }
  });

  useHoverEvaluator({
    canApplyHoverOverride,
    hoveredSquare,
    selectedSquare,
    currentHoverEval,
    analysis,
    baseEvalScore,
    game,
  });

  onCleanup(() => {
    moveExecutor.abortAdvice();
    clearTimeout(evalTimeout);
  });

  createEffect(() => {
    activeGame().fen();
    setSelectedSquare(null);
    setHoveredSquare(null);
    setValidMoves([]);
    setHumanBestMove(null);
    setBaseEvalScore(null);
    if (!isTravelling()) {
      clearHoverOverride();
    }
    setCurrentHoverEval(null);
    send("stop");
    send("ucinewgame");
    resumeBaseAnalysis();
  });

  // Capture the best move and evaluation for the base position
  createEffect(() => {
    if (!currentHoverEval()) {
      const info = analysis().lastInfo;
      if (info && info.score) {
        setBaseEvalScore(info.score);
      }
      const bm = analysis().lastBestMove;
      if (bm) {
        setHumanBestMove(bm.move);
      }
    }
  });

  const handleBoardMouseEnter = () => {
    if (isReplaying()) return;
    applyHoverBaseline();
  };

  const handleBoardMouseLeave = () => {
    if (isReplaying()) return;

    setHoveredSquare(null);
    clearHoverOverride();
    setCurrentHoverEval(null);

    send("stop");
    resumeBaseAnalysis();
  };

  const handleSquareHover = (square: Square) => {
    if (isReplaying()) return;

    setHoveredSquare(square);
    applyHoverBaseline(square);

    if (!canApplyHoverOverride()) {
      setCurrentHoverEval(null);
      send("stop");
      return;
    }

    const selected = selectedSquare();
    if (selected && validMoves().includes(square)) {
      clearTimeout(evalTimeout);
      evalTimeout = window.setTimeout(() => {
        const gameCopy = new Chess(game().fen());
        try {
          gameCopy.move({ from: selected, to: square, promotion: "q" });

          const evalId = ++hoverEvalSeq;
          const newEval = {
            id: evalId,
            from: selected,
            to: square,
            fen: gameCopy.fen(),
          };
          setCurrentHoverEval(newEval);

          logger.action("Stockfish Hover Eval Request", newEval);

          send("stop");
          send(`position fen ${gameCopy.fen()}`);
          send("go depth 12");
        } catch (e) {
          setCurrentHoverEval(null);
          send("stop");
        }
      }, 150);
    } else {
      setCurrentHoverEval(null);
      send("stop");
      resumeBaseAnalysis();
    }
  };

  const handleSquareClick = async (square: Square) => {
    if (isReplaying()) return;

    const g = game();
    const selected = selectedSquare();
    const pieceOnSquare = g.get(square);

    logger.action("Square Clicked", { square, piece: pieceOnSquare, currentlySelected: selected });

    if (selected === square) {
      setSelectedSquare(null);
      setValidMoves([]);
      setHoveredSquare(null);
      clearHoverOverride();
      setCurrentHoverEval(null);
      send("stop");
      return;
    }

    if (selected) {
      const result = await moveExecutor.executeMove({
        game: g,
        selected,
        square,
        stockfishBestMove: humanBestMove() || undefined,
      });

      if (result.didMove) {
        setSelectedSquare(null);
        setValidMoves([]);
        setHoveredSquare(null);
        clearHoverOverride();
        setCurrentHoverEval(null);
        return;
      }
    }

    const isPlayerTurn = g.turn() === activePlayerColor();
    const canTouch = isPlayerTurn && pieceOnSquare?.color === activePlayerColor();

    if (canTouch) {
      setSelectedSquare(square);
      setValidMoves(g.moves({ square, verbose: true }).map((m) => m.to));
    } else {
      setSelectedSquare(null);
      setValidMoves([]);
      clearHoverOverride();
      setCurrentHoverEval(null);
    }
  };

  const handleDragStart = (square: Square, e: DragEvent) => {
    if (isReplaying()) {
      e.preventDefault();
      return;
    }

    const g = game();
    const piece = g.get(square);
    const isPlayerTurn = g.turn() === activePlayerColor();
    const canTouch = isPlayerTurn && piece?.color === activePlayerColor();

    if (!canTouch) {
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
    if (isReplaying()) return;
    handleSquareHover(square);
  };

  const handleDrop = async (square: Square, e: DragEvent) => {
    e.preventDefault();
    if (isReplaying()) return;

    const source = e.dataTransfer?.getData("text/plain") as Square;
    if (!source || source === square) return;

    if (selectedSquare() === source) {
      await handleSquareClick(square);
    }
  };

  const activeGame = () => {
    if (isTravelling()) return new Chess(travelFen());
    return game();
  };

  const lastMove = () => {
    if (isTravelling()) {
      const idx = travelIndex();
      if (idx > 0) return travelMoveHistory()[idx - 1];
      return null;
    }
    const idx = currentIndex();
    if (idx > 0) return moveHistory()[idx - 1];
    return null;
  };

  return {
    game,
    activeGame,
    lastMove,
    isReplaying,
    baseEvalScore,
    selectedSquare,
    hoveredSquare,
    validMoves,
    handleBoardMouseEnter,
    handleBoardMouseLeave,
    handleSquareHover,
    handleSquareClick,
    handleDragStart,
    handleDragEnter,
    handleDrop,
  };
}
