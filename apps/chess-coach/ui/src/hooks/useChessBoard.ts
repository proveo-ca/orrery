import { createSignal, createEffect, onMount, onCleanup } from 'solid-js';
import { Chess, type Square } from 'chess.js';
import { currentFen, addMoveToHistory, setAdvice, activePlayerColor, coachEmotion, setCoachEmotion, currentIndex, fenHistory } from '../store/gameStore';
import { logger } from '../utils/logger';

const API_URL = import.meta.env.VITE_API_URL || '';

export function useChessBoard() {
  const [game, setGame] = createSignal(new Chess(currentFen()));
  const [selectedSquare, setSelectedSquare] = createSignal<Square | null>(null);
  const [hoveredSquare, setHoveredSquare] = createSignal<Square | null>(null);
  const [validMoves, setValidMoves] = createSignal<string[]>([]);
  const [stockfish, setStockfish] = createSignal<Worker | null>(null);

  const isReplaying = () => currentIndex() < fenHistory().length - 1;
  
  let evalTimeout: number | undefined;
  let adviceAbortController: AbortController | null = null;
  let lastHoverEval: { from: Square; to: Square; fen: string } | null = null;

  onMount(() => {
    const sfWorker = new Worker('/stockfish-18-lite.js');
    sfWorker.postMessage('uci');
    
    sfWorker.onmessage = (event) => {
      const line = event.data;
      if (typeof line !== 'string') return;
      
      const match = line.match(/score cp (-?\d+)/);
      const mateMatch = line.match(/score mate (-?\d+)/);
      
      if (hoveredSquare() && selectedSquare()) {
        if (line.startsWith('info ') || line.startsWith('bestmove')) {
          logger.action('Stockfish Hover Eval', { line, lastHoverEval });
        }

        let isBlunder = false;
        const sideToMove = lastHoverEval?.fen.split(' ')[1] || game().fen().split(' ')[1] || 'w';
        const humanColor = activePlayerColor();
        const scoreMultiplier = sideToMove === humanColor ? 1 : -1;

        if (match) {
          const cp = parseInt(match[1], 10) * scoreMultiplier;
          if (cp <= -200) isBlunder = true;
        } else if (mateMatch) {
          const mate = parseInt(mateMatch[1], 10) * scoreMultiplier;
          if (mate < 0) isBlunder = true;
        }

        if (isBlunder) {
          setCoachEmotion('shocked');
        } else if (coachEmotion() === 'shocked') {
          setCoachEmotion('watching');
        }
      }
    };
    setStockfish(sfWorker);
  });

  onCleanup(() => {
    stockfish()?.terminate();
    adviceAbortController?.abort();
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
    stockfish()?.postMessage('stop');
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
          const sf = stockfish();
          if (sf) {
            lastHoverEval = { from: selected, to: square, fen: gameCopy.fen() };
            logger.action('Stockfish Hover Eval Request', lastHoverEval);

            sf.postMessage('stop');
            sf.postMessage(`position fen ${gameCopy.fen()}`);
            sf.postMessage('go depth 6');
          }
        } catch (e) {}
      }, 150);
    } else {
      if (coachEmotion() === 'shocked') setCoachEmotion('watching');
      stockfish()?.postMessage('stop');
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
      const move = g.moves({ square: selected, verbose: true }).find(m => m.to === square);

      if (move) {
        try {
          const gameCopy = new Chess(g.fen());
          const result = gameCopy.move({ from: selected, to: square, promotion: 'q' });

          if (result) {
            if (adviceAbortController) {
              adviceAbortController.abort();
              adviceAbortController = null;
            }

            const humanMoveSan = result.san;
            const fenAfterHuman = gameCopy.fen();
            
            addMoveToHistory(fenAfterHuman);
            setSelectedSquare(null);
            setValidMoves([]);
            setHoveredSquare(null);
            stockfish()?.postMessage('stop');

            setAdvice("Thinking about my move...");
            setCoachEmotion('thinking'); 
            
            const moveResponse = await fetch(`${API_URL}/move`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ move: humanMoveSan, fen: fenAfterHuman })
            });

            if (moveResponse.ok) {
              const moveData = await moveResponse.json();
              addMoveToHistory(moveData.fen);
              setAdvice("Move played! Let me think about some advice...");
              
              adviceAbortController = new AbortController();

              try {
                const adviceResponse = await fetch(`${API_URL}/advice`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ humanMove: humanMoveSan, aiMove: moveData.move, fen: moveData.fen }),
                  signal: adviceAbortController.signal
                });

                if (adviceResponse.ok) {
                  const adviceData = await adviceResponse.json();
                  setAdvice(adviceData.advice);
                  const adviceLower = adviceData.advice.toLowerCase();
                  if (adviceLower.includes('blunder') || adviceLower.includes('mistake')) {
                    setCoachEmotion('shocked', 3000);
                  } else {
                    setCoachEmotion('happy', 3000);
                  }
                } else {
                  setAdvice("Error getting advice.");
                  setCoachEmotion('shocked', 2000);
                }
              } catch (err: any) {
                if (err.name === 'AbortError') {
                  logger.action("Advice request aborted due to new move.");
                } else {
                  setAdvice("Error getting advice.");
                  setCoachEmotion('shocked', 2000);
                }
              }
            } else {
              setAdvice("Error communicating with the coach.");
              setCoachEmotion('shocked', 2000);
            }
          }
        } catch (e) {
          logger.error("Move execution error", e);
        }
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
