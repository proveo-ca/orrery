import { createSignal, createEffect, onCleanup } from 'solid-js';
import { Chess, type Square } from 'chess.js';
import { baseAdvice, baseCoachEmotion, clearHoverOverride, setHoverAdvice, setHoverEmotion } from '../store/coachState';
import { currentFen, currentIndex, fenHistory } from '../store/gameState';
import { activePlayerColor } from '../store/settingsState';
import { logger } from '../utils/logger';
import { useStockfishWorker } from './useStockfishWorker';
import { useMoveExecutor } from './useMoveExecutor';

const API_URL = import.meta.env.VITE_API_URL || '';

type HoverEval = { id: number; from: Square; to: Square; fen: string };

export function useChessBoard() {
  const [game, setGame] = createSignal(new Chess(currentFen()));
  const [selectedSquare, setSelectedSquare] = createSignal<Square | null>(null);
  const [hoveredSquare, setHoveredSquare] = createSignal<Square | null>(null);
  const [validMoves, setValidMoves] = createSignal<string[]>([]);
  const { send, analysis } = useStockfishWorker('/stockfish-18-lite.js');
  const moveExecutor = useMoveExecutor(API_URL, () => send('stop'));

  const isReplaying = () => currentIndex() < fenHistory().length - 1;

  let evalTimeout: number | undefined;
  let hoverEvalSeq = 0;
  let currentHoverEval: HoverEval | null = null;

  const canApplyHoverOverride = () => {
    const base = baseCoachEmotion();
    return base === 'idle' || base === 'watching';
  };

  const applyHoverBaseline = () => {
    if (!canApplyHoverOverride()) return;
    setHoverEmotion('watching');

    // Hover always overrides advice; baseline override matches current base advice
    // so the UI doesn't "jump" until we have something meaningful to say.
    setHoverAdvice(baseAdvice());
  };

  createEffect(() => {
    // If the base coach state becomes something "active" (thinking/happy/shocked/sleepy/etc),
    // ensure hover doesn't mask it.
    if (!canApplyHoverOverride()) {
      clearHoverOverride();
      currentHoverEval = null;
      send('stop');
    }
  });

  createEffect(() => {
    if (!canApplyHoverOverride()) return;

    const hovered = hoveredSquare();
    const selected = selectedSquare();
    if (!hovered || !selected) return;

    const evalTarget = currentHoverEval;
    if (!evalTarget) return;
    if (evalTarget.to !== hovered || evalTarget.from !== selected) return;

    const msg = analysis().last;
    if (!msg || msg.type !== 'info' || !msg.score) return;

    const sideToMove = evalTarget.fen.split(' ')[1] || 'w';

    let isBlunder = false;
    const humanColor = activePlayerColor();
    const scoreMultiplier = sideToMove === humanColor ? 1 : -1;

    if (msg.score.kind === 'cp') {
      const cp = msg.score.value * scoreMultiplier;
      if (cp < -200) isBlunder = true;
    } else if (msg.score.kind === 'mate') {
      const mate = msg.score.value * scoreMultiplier;
      if (mate < 0) isBlunder = true;
    }

    if (!isBlunder) return;

    logger.action('Stockfish Hover Blunder Detected', { msg, evalTarget });

    const piece = game().get(evalTarget.from);
    const pieceName = piece ? `${piece.color}${piece.type}` : 'piece';

    setHoverAdvice(`Moving the ${pieceName} to ${evalTarget.to} is a blunder`);
    setHoverEmotion('shocked');
  });

  onCleanup(() => {
    moveExecutor.abortAdvice();
  });

  createEffect(() => {
    setGame(new Chess(currentFen()));
    setSelectedSquare(null);
    setHoveredSquare(null);
    setValidMoves([]);
    clearHoverOverride();
    currentHoverEval = null;
    send('stop');
  });

  const handleBoardMouseEnter = () => {
    if (isReplaying()) return;
    applyHoverBaseline();
  };

  const handleBoardMouseLeave = () => {
    if (isReplaying()) return;

    setHoveredSquare(null);
    clearHoverOverride();
    currentHoverEval = null;

    send('stop');
  };

  const handleSquareHover = (square: Square) => {
    if (isReplaying()) return;

    setHoveredSquare(square);
    applyHoverBaseline();

    if (!canApplyHoverOverride()) {
      currentHoverEval = null;
      send('stop');
      return;
    }

    const selected = selectedSquare();
    if (selected && validMoves().includes(square)) {
      clearTimeout(evalTimeout);
      evalTimeout = window.setTimeout(() => {
        const gameCopy = new Chess(game().fen());
        try {
          gameCopy.move({ from: selected, to: square, promotion: 'q' });

          currentHoverEval = {
            id: ++hoverEvalSeq,
            from: selected,
            to: square,
            fen: gameCopy.fen()
          };

          logger.action('Stockfish Hover Eval Request', currentHoverEval);

          // Reset any prior blunder output immediately when hovering a new candidate square.
          applyHoverBaseline();

          send('stop');
          send(`position fen ${gameCopy.fen()}`);
          send('go depth 6');
        } catch (e) {
          currentHoverEval = null;
          send('stop');
        }
      }, 150);
    } else {
      currentHoverEval = null;
      send('stop');
    }
  };

  const handleSquareClick = async (square: Square) => {
    if (isReplaying()) return;

    const g = game();
    const selected = selectedSquare();
    const pieceOnSquare = g.get(square);

    logger.action('Square Clicked', { square, piece: pieceOnSquare, currentlySelected: selected });

    if (selected === square) {
      setSelectedSquare(null);
      setValidMoves([]);
      setHoveredSquare(null);
      clearHoverOverride();
      currentHoverEval = null;
      send('stop');
      return;
    }

    if (selected) {
      const sfBestMove = analysis().lastBestMove?.raw?.split(' ')[1]; // e.g. "bestmove e2e4" -> "e2e4"
      const result = await moveExecutor.executeMove({
        game: g,
        selected,
        square,
        stockfishBestMove: sfBestMove
      });

      if (result.didMove) {
        setSelectedSquare(null);
        setValidMoves([]);
        setHoveredSquare(null);
        clearHoverOverride();
        currentHoverEval = null;
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
      currentHoverEval = null;
    }
  };

  return {
    game,
    selectedSquare,
    hoveredSquare,
    validMoves,
    handleBoardMouseEnter,
    handleBoardMouseLeave,
    handleSquareHover,
    handleSquareClick
  };
}
