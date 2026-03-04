import { Chess, type Square } from 'chess.js';
import { createSignal } from 'solid-js';
import { setAdvice, setCoachEmotion, thinkingPhrases, bestMovePhrases } from '../store/coachState';
import { addMoveToHistory } from '../store/gameState';
import { difficulty } from '../store/settingsState';
import { logger } from '../utils/logger';
import { postAdvice, postMove } from '../services/api';

type ExecuteMoveParams = {
  game: Chess;
  selected: Square;
  square: Square;
  stockfishBestMove?: string;
};

export function useMoveExecutor(apiUrl: string, stopStockfish: () => void) {
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
          setCoachEmotion('shocked');
          setAdvice("Checkmate! You win!");
        } else if (gameCopy.isThreefoldRepetition()) {
          setCoachEmotion('sleepy');
          setAdvice("Game over — draw by threefold repetition.");
        } else {
          setCoachEmotion('sleepy');
          setAdvice("Game over. It's a draw.");
        }
        return { didMove: true, fenAfterHuman };
      }
      
      if (params.stockfishBestMove && humanMoveLan === params.stockfishBestMove) {
        const phrases = bestMovePhrases();
        setAdvice(phrases[Math.floor(Math.random() * phrases.length)]);
        setCoachEmotion('happy', 3000);
      } else {
        setCoachEmotion('thinking');
        const phrases = thinkingPhrases();
        setAdvice(phrases[Math.floor(Math.random() * phrases.length)]);
      }
      
      let moveData: { fen: string; move: string };
      try {
        moveData = await postMove(apiUrl, { humanMoveSan, fenAfterHuman, difficulty: difficulty() });
      } catch (e) {
        setAdvice('Error communicating with the coach.');
        setCoachEmotion('shocked', 2000);
        return { didMove: true, fenAfterHuman };
      }
      
      const aiGame = new Chess(fenAfterHuman);
      const aiMove = aiGame.move(moveData.move);
      addMoveToHistory(moveData.fen, { from: aiMove.from, to: aiMove.to });

      // Check if AI ended the game
      const finalGame = new Chess(moveData.fen);
      if (finalGame.isGameOver()) {
        if (finalGame.isCheckmate()) {
          setCoachEmotion('happy');
          setAdvice("Checkmate! I win!");
        } else if (finalGame.isThreefoldRepetition()) {
          setCoachEmotion('sleepy');
          setAdvice("Game over — draw by threefold repetition.");
        } else {
          setCoachEmotion('sleepy');
          setAdvice("Game over. It's a draw.");
        }
        return { didMove: true, fenAfterHuman };
      }

      // AI moved — switch to idle while advice loads
      setCoachEmotion('idle');

      const controller = new AbortController();
      setAdviceAbortController(controller);

      try {
        const adviceData = await postAdvice(
          apiUrl,
          { humanMove: humanMoveSan, aiMove: moveData.move, fen: moveData.fen },
          { signal: controller.signal }
        );

        setAdvice(adviceData.advice);
        const adviceLower = adviceData.advice.toLowerCase();
        if (adviceLower.includes('blunder') || adviceLower.includes('mistake')) {
          setCoachEmotion('shocked', 3000);
        } else {
          setCoachEmotion('idle');
        }
      } catch (err: any) {
        if (err.name === 'AbortError') {
          logger.action('Advice request aborted due to new move.');
        } else {
          setAdvice('Error getting advice.');
          setCoachEmotion('shocked', 2000);
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
