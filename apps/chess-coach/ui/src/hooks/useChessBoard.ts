import { createSignal, createEffect, onCleanup } from 'solid-js';
import { Chess, type Square } from 'chess.js';
import { currentFen, activePlayerColor, coachEmotion, setCoachEmotion, currentIndex, fenHistory } from '../store/gameStore';
import { logger } from '../utils/logger';
import { useStockfishWorker } from './useStockfishWorker';
import { useMoveExecutor } from './useMoveExecutor';

const API_URL = import.meta.env.VITE_API_URL || '';

export function useChessBoard() {
  const [game, setGame] = createSignal(new Chess(currentFen()));
  const [selectedSquare, setSelectedSquare] = createSignal<Square | null>(null);
  const [hoveredSquare, setHoveredSquare] = createSignal<Square | null>(null);
  const [validMoves, setValidMoves] = createSignal<string[]>([]);
  const { send, analysis } = useStockfishWorker('/stockfish-18-lite.js');
  const moveExecutor = useMoveExecutor(API_URL, () => send('stop'));

  const isReplaying = () => currentIndex() < fenHistory().length - 1;
  
  let evalTimeout: number | undefined;
  let lastHoverEval: { from: Square; to: Square; fen: string } | null = null;

  createEffect(() => {
    if (!(hoveredSquare() && selectedSquare())) return;

    const msg = analysis().last;
    if (!msg) return;

    if (msg.type === 'info' || msg.type === 'bestmove') {
      const sideToMove = lastHoverEval?.fen.split(' ')[1] || game().fen().split(' ')[1] || 'w';
      logger.action('Stockfish Hover Eval', { msg, lastHoverEval, sideToMove });

      let isBlunder = false;
      const humanColor = activePlayerColor();
      const scoreMultiplier = sideToMove === humanColor ? 1 : -1;

      if (msg.type === 'info' && msg.score) {
        if (msg.score.kind === 'cp') {
          const cp = msg.score.value * scoreMultiplier;
          if (cp > 150) isBlunder = true;
        } else if (msg.score.kind === 'mate') {
          const mate = msg.score.value * scoreMultiplier;
          if (mate < 0) isBlunder = true;
        }
      }

      if (isBlunder) {
        logger.action('Stockfish Hover Blunder Detected', { msg, lastHoverEval });
        setCoachEmotion('shocked');
      } else if (coachEmotion() === 'shocked') {
        setCoachEmotion('watching');
      }
    }
  });

  onCleanup(() => {
    moveExecutor.abortAdvice();
  });

  createEffect(() => {
    setGame(new Chess(currentFen()));
    setSelectedSquare(null);
    setHoveredSquare(null);
    setValidMoves([]);
  });

  const handleBoardMouseEnter = () => {
    if (isReplaying()) return;
    if (coachEmotion() === 'idle') setCoachEmotion('watching');
  };

  const handleBoardMouseLeave = () => {
    if (isReplaying()) return;
    setHoveredSquare(null);
    if (coachEmotion() === 'watching' || coachEmotion() === 'shocked') setCoachEmotion('idle');
    send('stop');
  };

  const handleSquareHover = (square: Square) => {
    if (isReplaying()) return;

    setHoveredSquare(square);
    const selected = selectedSquare();
    
    if (selected && validMoves().includes(square)) {
      clearTimeout(evalTimeout);
      evalTimeout = window.setTimeout(() => {
        const gameCopy = new Chess(game().fen());
        try {
          gameCopy.move({ from: selected, to: square, promotion: 'q' });
          lastHoverEval = { from: selected, to: square, fen: gameCopy.fen() };
          logger.action('Stockfish Hover Eval Request', lastHoverEval);

          send('stop');
          send(`position fen ${gameCopy.fen()}`);
          send('go depth 6');
        } catch (e) {}
      }, 150);
    } else {
      if (coachEmotion() === 'shocked') setCoachEmotion('watching');
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
      return;
    }

    if (selected) {
      const didMove = await moveExecutor.executeMove({ game: g, selected, square });

      if (didMove) {
        setSelectedSquare(null);
        setValidMoves([]);
        setHoveredSquare(null);
        return;
      }
    }

    const isPlayerTurn = g.turn() === activePlayerColor();
    const canTouch = isPlayerTurn && pieceOnSquare?.color === activePlayerColor();

    if (canTouch) {
      setSelectedSquare(square);
      setValidMoves(g.moves({ square, verbose: true }).map(m => m.to));
    } else {
      setSelectedSquare(null);
      setValidMoves([]);
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
