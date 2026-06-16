// SPEC: _spec/chess-coach/ui/components.puml
import { Chess, type Color, type Square } from "chess.js";
import { createEffect, createMemo, createSignal, onCleanup, untrack } from "solid-js";

import { enginePool } from "~/engine/EnginePool";
import { useCoachBehavior } from "~/hooks/useCoachBehavior";
import { type HoverEval, useHoverEvaluator } from "~/hooks/useHoverEvaluator";
import { useMoveExecutor } from "~/hooks/useMoveExecutor";
import { getAnalysisDepth } from "~/services/runtimeMode";
import type { StockfishAnalysis } from "~/types/Stockfish";
import { capabilities } from "~/store/capabilitiesStore";
import { setBaseEvalScore as setSharedEval } from "~/store/evalStore";
import {
  type CoachEmotion,
  baseAdvice,
  baseCoachEmotion,
  clearHoverOverride,
  clearPendingTravel,
  pendingTravel,
  setAdviceArrow,
  setAdviceHoveredSquares,
  setHoverAdvice,
  setHoverEmotion,
} from "~/store/coachStore";
import {
  type MoveSquares,
  currentFen,
  currentIndex,
  fenHistory,
  game as latestGame,
  moveHistory,
} from "~/store/gameStore";
import {
  type PieceSet,
  activePlayerColor,
  opponentPieceSet,
  playerPieceSet,
} from "~/store/settingsStore";
import { isTravelling, travelFen, travelIndex, travelMoveHistory } from "~/store/travelStore";
import { logger } from "~/utils/logger";

export function useChessBoard() {
  // When viewing the latest position, return the authoritative instance
  // (full history for isGameOver/isThreefoldRepetition). When viewing a
  // past position, a short-lived instance from the FEN is fine for rendering.
  // equals: false — the authoritative instance is mutated in-place, so
  // reference equality would hide state changes from SolidJS.
  const game = createMemo(
    () => {
      const idx = currentIndex();
      const total = latestGame().history().length;
      if (idx === total) return latestGame();
      return new Chess(currentFen());
    },
    undefined,
    { equals: false },
  );
  const [selectedSquare, setSelectedSquare] = createSignal<Square | null>(null);
  const [hoveredSquare, setHoveredSquare] = createSignal<Square | null>(null);
  const [validMoves, setValidMoves] = createSignal<string[]>([]);

  // Promotion modal state. When a move would promote a pawn, we pause the
  // move execution and surface the pawn's color / piece-set so the UI can
  // render the picker; the resolver is held here and invoked by the UI's
  // select/cancel handlers. Cancelling resolves with `null` and
  // moveExecutor returns cancelled:true so selection is preserved.
  type PromotionPiece = "q" | "r" | "b" | "n";
  const [pendingPromotion, setPendingPromotion] = createSignal<{
    color: Color;
    pieceSet: PieceSet;
    resolve: (piece: PromotionPiece | null) => void;
  } | null>(null);

  const requestPromotion = (color: Color, pieceSet: PieceSet) =>
    new Promise<PromotionPiece | null>((resolve) => {
      setPendingPromotion({ color, pieceSet, resolve });
    });

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
  // Hover-eval analysis stream consumed by useHoverEvaluator. Base (arrow)
  // analysis now writes its own signals directly via onInfo, so this stream
  // carries ONLY hover evals — base and hover no longer share a worker/stream.
  const [analysis, setAnalysis] = createSignal<StockfishAnalysis>({
    last: null,
    lastInfo: null,
    lastBestMove: null,
  });

  let baseController: AbortController | null = null;
  let hoverController: AbortController | null = null;
  const stopBase = () => {
    baseController?.abort();
    baseController = null;
  };
  const stopHover = () => {
    hoverController?.abort();
    hoverController = null;
  };
  const stopAnalysis = () => {
    stopBase();
    stopHover();
  };

  const moveExecutor = useMoveExecutor(() => stopAnalysis());
  const coachBehavior = useCoachBehavior();

  // When historyBranching is enabled, past-history positions are fully
  // editable (moves branch), so we never enter the "replaying" state that
  // locks input / shows overlays.
  const isReplaying = () =>
    !capabilities().historyBranching &&
    (isTravelling() || currentIndex() < fenHistory().length - 1);

  let evalTimeout: number | undefined;
  let hoverEvalSeq = 0;
  const [currentHoverEval, setCurrentHoverEval] = createSignal<HoverEval | null>(null);
  const [humanBestMove, setHumanBestMove] = createSignal<string | null>(null);
  const [baseEvalScore, setBaseEvalScore] = createSignal<{
    kind: "cp" | "mate";
    value: number;
  } | null>(null);

  // Continuous best-move-arrow + eval for the live position, on its own pool
  // job at NORMAL priority. A hover eval (interactive) runs on a separate
  // worker instead of hijacking this one, so `info pv[0]` stays scoped to the
  // current position and the arrow stops flickering. We read pv[0] from the
  // streamed info — never the stop-response bestmove, which can be a stale
  // shallow move.
  const startBase = () => {
    baseController?.abort();
    const g = activeGame();
    if (g.isGameOver()) return;
    if (!(capabilities().continuousAnalysis || g.turn() === activePlayerColor() || isReplaying())) {
      return;
    }
    const ctrl = new AbortController();
    baseController = ctrl;
    enginePool
      .evaluate({
        fen: g.fen(),
        depth: getAnalysisDepth(),
        priority: "normal",
        signal: ctrl.signal,
        onInfo: (info) => {
          if (info.score) {
            setBaseEvalScore(info.score);
            setSharedEval(info.score);
          }
          if (info.pv && info.pv.length > 0) setHumanBestMove(info.pv[0]);
        },
      })
      .catch(() => {});
  };

  // Transient eval of a candidate move at INTERACTIVE priority (preempts
  // background work, runs alongside base analysis). Feeds the hover stream
  // useHoverEvaluator reads to detect blunders.
  const startHover = (fen: string) => {
    hoverController?.abort();
    const ctrl = new AbortController();
    hoverController = ctrl;
    enginePool
      .evaluate({
        fen,
        depth: getAnalysisDepth(),
        priority: "interactive",
        signal: ctrl.signal,
        onInfo: (info) => {
          const msg = {
            type: "info" as const,
            depth: info.depth,
            score: info.score,
            pv: info.pv,
            raw: "",
          };
          setAnalysis({ last: msg, lastInfo: msg, lastBestMove: null });
        },
      })
      .catch(() => {});
  };

  // When showBestMove is enabled, expose the best move's from/to squares
  // so the board can draw a single arrow from FROM to TO. Null when the
  // capability is off or no best move is known yet.
  const bestMoveArrow = (): { from: Square; to: Square } | null => {
    if (!capabilities().showBestMove) return null;
    const uci = humanBestMove();
    if (!uci || uci.length < 4) return null;
    return { from: uci.slice(0, 2) as Square, to: uci.slice(2, 4) as Square };
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
      clearTimeout(evalTimeout);
      clearHoverOverride();
      setCurrentHoverEval(null);
      stopHover();
    }
  });

  useHoverEvaluator({
    canApplyHoverOverride,
    hoveredSquare,
    selectedSquare,
    currentHoverEval,
    analysis,
    baseEvalScore,
    humanBestMove,
    game,
  });

  onCleanup(() => {
    coachBehavior.abortAdvice();
    clearTimeout(evalTimeout);
    stopAnalysis();
  });

  createEffect(() => {
    const fen = activeGame().fen();
    setSelectedSquare(null);
    setHoveredSquare(null);
    setValidMoves([]);
    setHumanBestMove(null);
    setBaseEvalScore(null);
    setSharedEval(null);
    setAdviceHoveredSquares([]);
    setAdviceArrow(null);
    if (!isTravelling()) {
      clearHoverOverride();

      // untrack: reading pendingTravel() reactively here would cause this
      // effect to re-fire on blunder detection (when useHoverEvaluator sets
      // pendingTravel), clobbering selectedSquare / validMoves mid-drag.
      const pending = untrack(pendingTravel);
      if (pending) {
        const posNow = fen.split(" ").slice(0, 2).join(" ");
        const posBlunder = pending.blunderFen.split(" ").slice(0, 2).join(" ");
        if (posNow !== posBlunder) clearPendingTravel();
      }
    }
    setCurrentHoverEval(null);
    stopAnalysis();
    startBase();
  });

  const handleBoardMouseEnter = () => {
    if (isReplaying()) return;
    applyHoverBaseline();
  };

  const handleBoardMouseLeave = () => {
    if (isReplaying()) return;

    clearTimeout(evalTimeout);
    setHoveredSquare(null);
    clearHoverOverride();
    setCurrentHoverEval(null);
    setBaseEvalScore(null);
    setSharedEval(null);

    stopHover();
    startBase();
  };

  const handleSquareHover = (square: Square) => {
    if (isReplaying() || capabilities().readOnly) return;

    setHoveredSquare(square);
    applyHoverBaseline(square);

    if (!canApplyHoverOverride()) {
      clearTimeout(evalTimeout);
      setCurrentHoverEval(null);
      stopHover();
      return;
    }

    // Debounce all engine-touching work: only fire once the cursor has
    // settled on a square for 300ms. Without this, every square the user
    // crosses on the way to the intended target queues a stop+go pair,
    // starving the blunder eval before it can land.
    clearTimeout(evalTimeout);
    evalTimeout = window.setTimeout(() => {
      const selected = selectedSquare();
      if (selected && validMoves().includes(square)) {
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

          startHover(newEval.fen);
        } catch (err) {
          logger.error("Hover evaluation setup failed", err);
          setCurrentHoverEval(null);
          stopHover();
        }
      } else {
        setCurrentHoverEval(null);
        stopHover();
        startBase();
      }
    }, 300);
  };

  const handleSquareClick = async (square: Square) => {
    if (isReplaying() || capabilities().readOnly) return;

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
      stopHover();
      return;
    }

    if (selected) {
      const result = await moveExecutor.executeMove({
        game: g,
        selected,
        square,
        stockfishBestMove: humanBestMove() || undefined,
        onPromotionRequired: () => {
          const piece = g.get(selected);
          if (!piece) return Promise.resolve(null);
          const pieceSet =
            piece.color === activePlayerColor() ? playerPieceSet() : opponentPieceSet();
          return requestPromotion(piece.color, pieceSet);
        },
      });

      if (result.didMove) {
        setSelectedSquare(null);
        setValidMoves([]);
        setHoveredSquare(null);
        clearHoverOverride();
        setCurrentHoverEval(null);
        return;
      }

      // Promotion was cancelled — leave selection intact so the user can
      // retry the same move or pick a new square.
      if (result.cancelled) return;
    }

    const canTouch = capabilities().freeColorControl
      ? pieceOnSquare?.color === g.turn()
      : g.turn() === activePlayerColor() && pieceOnSquare?.color === activePlayerColor();

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
    if (isReplaying() || capabilities().readOnly) {
      e.preventDefault();
      return;
    }

    const g = game();
    const piece = g.get(square);
    const canTouch = capabilities().freeColorControl
      ? piece?.color === g.turn()
      : g.turn() === activePlayerColor() && piece?.color === activePlayerColor();

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
      // travelMoveHistory is 1-based: moves[0] is a `null` placeholder for
      // the starting fen, and moves[i] is the move that led to fens[i].
      // So at travelIndex=N, the last move is moves[N], NOT moves[N-1].
      const idx = travelIndex();
      if (idx > 0) return travelMoveHistory()[idx] ?? null;
      return null;
    }
    const idx = currentIndex();
    if (idx > 0) return moveHistory()[idx - 1];
    return null;
  };

  // Animation queue: ensures rapid successive moves (e.g., human+AI on /selena)
  // each get a visible 150ms slide instead of the later move clobbering the earlier.
  const [animationQueue, setAnimationQueue] = createSignal<MoveSquares[]>([]);
  const enqueueAnimation = (m: MoveSquares | null) => {
    if (!m) return;
    setAnimationQueue((q) => [...q, m]);
  };
  const consumeAnimation = (m: MoveSquares) => {
    setAnimationQueue((q) =>
      q.length && q[0].from === m.from && q[0].to === m.to ? q.slice(1) : q,
    );
  };
  let prevTravelIdx = 0;
  let wasTravelling = false;

  createEffect(() => {
    if (!isTravelling()) {
      const justExited = wasTravelling;
      wasTravelling = false;
      prevTravelIdx = 0;
      if (justExited) {
        setAnimationQueue([]);
      } else {
        const idx = currentIndex();
        if (idx > 0) enqueueAnimation(moveHistory()[idx - 1] ?? null);
      }
      return;
    }

    const idx = travelIndex();
    const moves = travelMoveHistory();

    if (!wasTravelling) {
      wasTravelling = true;
      prevTravelIdx = idx;
      setAnimationQueue([]);
      return;
    }

    if (idx > prevTravelIdx) {
      enqueueAnimation(moves[idx] ?? null);
    } else if (idx < prevTravelIdx) {
      const undone = moves[prevTravelIdx];
      if (undone) enqueueAnimation({ from: undone.to, to: undone.from });
    }
    prevTravelIdx = idx;
  });

  return {
    game,
    activeGame,
    lastMove,
    animationQueue,
    consumeAnimation,
    isReplaying,
    baseEvalScore,
    bestMoveArrow,
    selectedSquare,
    hoveredSquare,
    validMoves,
    pendingPromotion,
    resolvePromotion,
    cancelPromotion,
    handleBoardMouseEnter,
    handleBoardMouseLeave,
    handleSquareHover,
    handleSquareClick,
    handleDragStart,
    handleDragEnter,
    handleDrop,
  };
}
