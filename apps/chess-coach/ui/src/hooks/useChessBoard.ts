import { createSignal, createEffect, onCleanup } from 'solid-js';
import { Chess, type Square } from 'chess.js';
import { baseAdvice, baseCoachEmotion, clearHoverOverride, setHoverAdvice, setHoverEmotion, setHoverBlunder, type CoachEmotion } from '../store/coachState';
import { currentFen, currentIndex, fenHistory, moveHistory } from '../store/gameState';
import { isTravelling, travelFen, travelIndex, travelMoveHistory } from '../store/travelState';
import { activePlayerColor } from '../store/settingsState';
import { logger } from '../utils/logger';
import { useStockfishWorker } from './useStockfishWorker';
import { useMoveExecutor } from './useMoveExecutor';

type HoverEval = { id: number; from: Square; to: Square; fen: string };

export function useChessBoard() {
  const [game, setGame] = createSignal(new Chess(currentFen()));
  const [selectedSquare, setSelectedSquare] = createSignal<Square | null>(null);
  const [hoveredSquare, setHoveredSquare] = createSignal<Square | null>(null);
  const [validMoves, setValidMoves] = createSignal<string[]>([]);
  const { send, analysis } = useStockfishWorker('/stockfish-18-lite.js');
  const moveExecutor = useMoveExecutor(() => send('stop'));

  const isReplaying = () => isTravelling() || currentIndex() < fenHistory().length - 1;

  let evalTimeout: number | undefined;
  let hoverEvalSeq = 0;
  const [currentHoverEval, setCurrentHoverEval] = createSignal<HoverEval | null>(null);
  const [humanBestMove, setHumanBestMove] = createSignal<string | null>(null);
  const [baseEvalScore, setBaseEvalScore] = createSignal<{ kind: 'cp' | 'mate', value: number } | null>(null);

  const resumeBaseAnalysis = () => {
    const g = game();
    if (g.turn() === activePlayerColor() && !g.isGameOver() && !isTravelling()) {
      send(`position fen ${g.fen()}`);
      send('go depth 12');
    }
  };

  const canApplyHoverOverride = () => {
    const base = baseCoachEmotion();
    return base === 'idle' || base === 'watching' || base === 'watching--left' || base === 'watching--right';
  };

  const applyHoverBaseline = (square?: Square) => {
    if (!canApplyHoverOverride()) return;
    
    let emotion: CoachEmotion = 'watching';
    if (square) {
      const file = square[0];
      const isFlipped = activePlayerColor() === 'b';
      
      // If board is flipped, 'g'/'h' are on the left, 'a'/'b' are on the right
      const isLeftScreen = isFlipped ? (file === 'g' || file === 'h') : (file === 'a' || file === 'b');
      const isRightScreen = isFlipped ? (file === 'a' || file === 'b') : (file === 'g' || file === 'h');

      if (isLeftScreen) emotion = 'watching--left';
      else if (isRightScreen) emotion = 'watching--right';
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
      send('stop');
    }
  });

  let lastProcessedEvalId = -1;

  createEffect(() => {
    if (!canApplyHoverOverride()) return;

    const hovered = hoveredSquare();
    const selected = selectedSquare();
    if (!hovered || !selected) return;

    const evalTarget = currentHoverEval();
    if (!evalTarget) return;
    if (evalTarget.to !== hovered || evalTarget.from !== selected) return;

    const msg = analysis().lastInfo;
    if (!msg || !msg.score) return;

    const baseScore = baseEvalScore();
    if (!baseScore) return; // We need the before-score to calculate a delta

    // Skip if we already processed this eval's result
    if (evalTarget.id <= lastProcessedEvalId) return;

    // Anti-race-condition: Ensure the PV move is legal in the hover position.
    // If Stockfish sends an info message from a previous search, the PV move 
    // will almost certainly be illegal in the new FEN.
    if (!msg.pv || msg.pv.length === 0) {
      if (msg.score.kind !== 'mate' || msg.score.value !== 0) {
        return; // Ignore empty PVs unless it's a checkmate (mate 0)
      }
    } else {
      try {
        const testGame = new Chess(evalTarget.fen);
        const uci = msg.pv[0];
        const from = uci.slice(0, 2);
        const to = uci.slice(2, 4);
        const promotion = uci.length > 4 ? uci[4] : undefined;
        const move = testGame.move({ from, to, promotion });
        if (!move) return; // Stale info message from previous position
      } catch {
        return; // Invalid move format
      }
    }

    // Calculate Human's CP before the move
    const humanBaseCp = baseScore.kind === 'mate'
      ? (baseScore.value > 0 ? 10000 : -10000)
      : baseScore.value;

    // Calculate Human's CP after the move
    // msg.score is relative to the AI (since it's AI's turn in evalTarget.fen)
    const humanHoverCp = msg.score.kind === 'mate'
      ? (msg.score.value > 0 ? -10000 : 10000)
      : -msg.score.value;

    // A blunder is a move that drops the evaluation by 200+ centipawns
    const delta = humanHoverCp - humanBaseCp;
    const isBlunder = delta <= -200;

    logger.action(`Hover Eval Result [${evalTarget.from}-${evalTarget.to}]`, { 
      baseScore,
      hoverScore: msg.score,
      delta,
      isBlunder 
    });

    if (!isBlunder) return;

    logger.action('Stockfish Hover Blunder Detected', { msg, evalTarget });

    const piece = game().get(evalTarget.from);
    const pieceName = piece ? `${piece.color}${piece.type}` : 'piece';

    // Generate SAN for the blunder
    const gCopy = new Chess(currentFen());
    const m = gCopy.move({ from: evalTarget.from, to: evalTarget.to, promotion: 'q' });
    const san = m ? m.san : `${evalTarget.from}-${evalTarget.to}`;

    lastProcessedEvalId = evalTarget.id;
    setHoverAdvice(`Moving the ${pieceName} to ${evalTarget.to} is a blunder`);
    setHoverEmotion('shocked');
    setHoverBlunder(true, evalTarget.fen, san);
  });

  onCleanup(() => {
    moveExecutor.abortAdvice();
  });

  createEffect(() => {
    setGame(new Chess(currentFen()));
    setSelectedSquare(null);
    setHoveredSquare(null);
    setValidMoves([]);
    setHumanBestMove(null);
    setBaseEvalScore(null);
    if (!isTravelling()) {
      clearHoverOverride();
    }
    setCurrentHoverEval(null);
    send('stop');
    send('ucinewgame');
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

    send('stop');
    resumeBaseAnalysis();
  };

  const handleSquareHover = (square: Square) => {
    if (isReplaying()) return;

    setHoveredSquare(square);
    applyHoverBaseline(square);

    if (!canApplyHoverOverride()) {
      setCurrentHoverEval(null);
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

          const evalId = ++hoverEvalSeq;
          const newEval = {
            id: evalId,
            from: selected,
            to: square,
            fen: gameCopy.fen()
          };
          setCurrentHoverEval(newEval);

          logger.action('Stockfish Hover Eval Request', newEval);

          send('stop');
          send(`position fen ${gameCopy.fen()}`);
          send('go depth 8');
        } catch (e) {
          setCurrentHoverEval(null);
          send('stop');
        }
      }, 150);
    } else {
      setCurrentHoverEval(null);
      send('stop');
      resumeBaseAnalysis();
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
      setCurrentHoverEval(null);
      send('stop');
      return;
    }

    if (selected) {
      const result = await moveExecutor.executeMove({
        game: g,
        selected,
        square,
        stockfishBestMove: humanBestMove() || undefined
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
    selectedSquare,
    hoveredSquare,
    validMoves,
    handleBoardMouseEnter,
    handleBoardMouseLeave,
    handleSquareHover,
    handleSquareClick
  };
}
