import { Chess } from 'chess.js';
import { createSignal } from 'solid-js';
import type { MoveSquares } from '../store/gameState';
import { startTravel } from '../store/travelState';
import { setHoverAdvice, setHoverEmotion } from '../store/coachState';
import { stockfishService } from '../services/stockfishService';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

/**
 * Requests the best line (PV) from a dedicated Stockfish worker,
 * then plays it out move-by-move to build a fake timeline.
 */
export function useTravelMode(workerPath: string = '/stockfish-18-lite.js') {
  const [loading, setLoading] = createSignal(false);

  const requestPV = (fen: string, depth: number = 12): Promise<string[]> => {
    stockfishService.getWorker(workerPath);

    return new Promise<string[]>((resolve) => {
      let bestPV: string[] = [];

      const handler = (event: MessageEvent) => {
        const raw = event.data;
        if (typeof raw !== 'string') return;

        const tokens = raw.trim().split(/\s+/);

        if (tokens[0] === 'info') {
          const pvIdx = tokens.indexOf('pv');
          if (pvIdx !== -1) {
            const pv = tokens.slice(pvIdx + 1);
            if (pv.length > bestPV.length) {
              bestPV = pv;
            }
          }
        }

        if (tokens[0] === 'bestmove') {
          stockfishService.removeListener(handler);
          // If PV was empty, use the bestmove itself
          if (bestPV.length === 0 && tokens[1] && tokens[1] !== '(none)') {
            bestPV = [tokens[1]];
          }
          resolve(bestPV);
        }
      };

      stockfishService.addListener(handler);
      stockfishService.send('stop');
      stockfishService.send('ucinewgame');
      stockfishService.send(`position fen ${fen}`);
      stockfishService.send(`go depth ${depth}`);
    });
  };

  const activateTravel = async (blunderFen: string) => {
    setLoading(true);
    setHoverAdvice('Travelling...');
    setHoverEmotion('thinking');

    // Fire off the explanation request in parallel
    fetch(`${API_URL}/explain`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fen: blunderFen })
    })
      .then(res => res.json())
      .then(data => {
        if (data.explanation) setHoverAdvice(data.explanation);
      })
      .catch(err => console.error('Failed to fetch explanation', err));

    try {
      const pv = await requestPV(blunderFen, 12);
      // Take up to 8 moves, or fewer if the PV is shorter (e.g. mate in 1)
      const movesToPlay = pv.slice(0, 8);

      if (movesToPlay.length === 0) {
        setHoverAdvice('Could not calculate a line.');
        setHoverEmotion('shocked');
        setLoading(false);
        return;
      }

      const fens: string[] = [blunderFen];
      const moves: (MoveSquares | null)[] = [null];

      let current = new Chess(blunderFen);
      for (const uci of movesToPlay) {
        try {
          const from = uci.slice(0, 2);
          const to = uci.slice(2, 4);
          const promotion = uci.length > 4 ? uci[4] : undefined;
          const result = current.move({ from, to, promotion });
          if (!result) break;
          fens.push(current.fen());
          moves.push({ from: result.from, to: result.to });
          // Stop early if the game is over (checkmate, stalemate, etc.)
          if (current.isGameOver()) break;
        } catch {
          break;
        }
      }

      startTravel(fens, moves);
      // We don't overwrite hoverAdvice here so the LLM explanation stays visible
      setHoverEmotion('watching');
    } catch {
      setHoverAdvice('Failed to calculate line.');
      setHoverEmotion('shocked');
    } finally {
      setLoading(false);
    }
  };

  return { activateTravel, loading };
}
