import { Chess, type Square } from 'chess.js';
import { createSignal } from 'solid-js';
import { addMoveToHistory, difficulty, setAdvice, dispatchCoachEvent, thinkingPhrases, bestMovePhrases } from '../store';
import { logger } from '../utils/logger';
import { postAdviceStream, postMove } from '../services/api';

type ExecuteMoveParams = {
  game: Chess;
  selected: Square;
  square: Square;
  stockfishBestMove?: string;
};

export function useMoveExecutor(stopStockfish: () => void) {
  const [adviceAbortController, setAdviceAbortController] = createSignal<AbortController | null>(null);

  const abortAdvice = () => {
    const controller = adviceAbortController();
    if (controller) controller.abort();
    setAdviceAbortController(null);
  };

  const executeMove = async (
    params: ExecuteMoveParams
  ): Promise<{ didMove: boolean; fenAfterHuman?: string }> => {
    const { game, selected, square } = params;

    const move = game.moves({ square: selected, verbose: true }).find((m) => m.to === square);
    if (!move) return { didMove: false };

    try {
      const gameCopy = new Chess(game.fen());
      const result = gameCopy.move({ from: selected, to: square, promotion: 'q' });

      if (!result) return { didMove: false };

      abortAdvice();

      const humanMoveSan = result.san;
      const humanMoveLan = result.lan; // e.g. "e2e4"
      const fenAfterHuman = gameCopy.fen();

      addMoveToHistory(fenAfterHuman, { from: result.from, to: result.to });
      stopStockfish();

      // Check if human ended the game
      if (gameCopy.isGameOver()) {
        if (gameCopy.isCheckmate()) {
          dispatchCoachEvent({ type: 'GAME_OVER', result: 'win' });
          setAdvice("Checkmate! You win!");
        } else if (gameCopy.isThreefoldRepetition()) {
          dispatchCoachEvent({ type: 'GAME_OVER', result: 'draw' });
          setAdvice("Game over — draw by threefold repetition.");
        } else {
          dispatchCoachEvent({ type: 'GAME_OVER', result: 'draw' });
          setAdvice("Game over. It's a draw.");
        }
        return { didMove: true, fenAfterHuman };
      }
      
      if (params.stockfishBestMove && humanMoveLan === params.stockfishBestMove) {
        const phrases = bestMovePhrases();
        setAdvice(phrases[Math.floor(Math.random() * phrases.length)]);
        dispatchCoachEvent({ type: 'HUMAN_MOVE_BEST' });
      } else {
        dispatchCoachEvent({ type: 'HUMAN_MOVE_NORMAL' });
        const phrases = thinkingPhrases();
        setAdvice(phrases[Math.floor(Math.random() * phrases.length)]);
      }
      
      let moveData: { fen: string; move: string };
      try {
        moveData = await postMove({ humanMoveSan, fenAfterHuman, difficulty: difficulty() });
      } catch (e) {
        setAdvice('Error communicating with the coach.');
        dispatchCoachEvent({ type: 'AI_ERROR' });
        return { didMove: true, fenAfterHuman };
      }
      
      const aiGame = new Chess(fenAfterHuman);
      const aiMove = aiGame.move(moveData.move);
      addMoveToHistory(moveData.fen, { from: aiMove.from, to: aiMove.to });

      // Check if AI ended the game
      const finalGame = new Chess(moveData.fen);
      if (finalGame.isGameOver()) {
        if (finalGame.isCheckmate()) {
          dispatchCoachEvent({ type: 'GAME_OVER', result: 'loss' });
          setAdvice("Checkmate! I win!");
        } else if (finalGame.isThreefoldRepetition()) {
          dispatchCoachEvent({ type: 'GAME_OVER', result: 'draw' });
          setAdvice("Game over — draw by threefold repetition.");
        } else {
          dispatchCoachEvent({ type: 'GAME_OVER', result: 'draw' });
          setAdvice("Game over. It's a draw.");
        }
        return { didMove: true, fenAfterHuman };
      }

      // AI moved — switch to idle while advice loads
      dispatchCoachEvent({ type: 'AI_MOVED' });

      const controller = new AbortController();
      setAdviceAbortController(controller);

      try {
        let fullAdvice = '';
        let receivedFirstChunk = false;

        await postAdviceStream(
          { humanMove: humanMoveSan, aiMove: moveData.move, fen: moveData.fen },
          (chunk) => {
            if (!receivedFirstChunk) {
              fullAdvice = ''; // Clear the "thinking" phrase on first token
              receivedFirstChunk = true;
            }
            fullAdvice += chunk;
            setAdvice(fullAdvice);
          },
          { signal: controller.signal }
        );

        const adviceLower = fullAdvice.toLowerCase();
        const isBlunder = adviceLower.includes('blunder') || adviceLower.includes('mistake');
        dispatchCoachEvent({ type: 'ADVICE_RECEIVED', isBlunder });
      } catch (err: any) {
        if (err.name === 'AbortError') {
          logger.action('Advice request aborted due to new move.');
        } else {
          setAdvice('Error getting advice.');
          dispatchCoachEvent({ type: 'AI_ERROR' });
        }
      }

      return { didMove: true, fenAfterHuman };
    } catch (e) {
      logger.error('Move execution error', e);
      return { didMove: false };
    }
  };

  return { executeMove, abortAdvice };
}
