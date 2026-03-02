import { Chess, type Square } from 'chess.js';
import { createSignal } from 'solid-js';
import { addMoveToHistory, setAdvice, setCoachEmotion } from '../store/gameStore';
import { logger } from '../utils/logger';
import { postAdvice, postMove } from '../services/api';

type ExecuteMoveParams = {
  game: Chess;
  selected: Square;
  square: Square;
};

export function useMoveExecutor(apiUrl: string, stopStockfish: () => void) {
  const [adviceAbortController, setAdviceAbortController] = createSignal<AbortController | null>(null);

  const abortAdvice = () => {
    const controller = adviceAbortController();
    if (controller) controller.abort();
    setAdviceAbortController(null);
  };

  const executeMove = async (params: ExecuteMoveParams): Promise<{ fenAfterHuman?: string } | null> => {
    const { game, selected, square } = params;

    const move = game.moves({ square: selected, verbose: true }).find((m) => m.to === square);
    if (!move) return null;

    try {
      const gameCopy = new Chess(game.fen());
      const result = gameCopy.move({ from: selected, to: square, promotion: 'q' });

      if (!result) return null;

      abortAdvice();

      const humanMoveSan = result.san;
      const fenAfterHuman = gameCopy.fen();

      addMoveToHistory(fenAfterHuman);
      stopStockfish();
      setCoachEmotion('thinking')
      let moveData: { fen: string; move: string };
      try {
        moveData = await postMove(apiUrl, { move: humanMoveSan, fen: fenAfterHuman });
      } catch (e) {
        setAdvice('Error communicating with the coach.');
        setCoachEmotion('shocked', 2000);
        return { fenAfterHuman };
      }

      addMoveToHistory(moveData.fen);

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
          setCoachEmotion('happy', 3000);
        }
      } catch (err: any) {
        if (err.name === 'AbortError') {
          logger.action('Advice request aborted due to new move.');
        } else {
          setAdvice('Error getting advice.');
          setCoachEmotion('shocked', 2000);
        }
      }

      return { fenAfterHuman };
    } catch (e) {
      logger.error('Move execution error', e);
      return null;
    }
  };

  return { executeMove, abortAdvice };
}
