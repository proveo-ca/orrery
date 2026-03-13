import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useTravelMode } from '../src/hooks/useTravelMode';
import { stockfishService } from '../src/services/stockfishService';
import { startTravel } from '../src/store/travelState';

// Mock the stockfish service
vi.mock('../src/services/stockfishService', () => ({
  stockfishService: {
    getWorker: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    send: vi.fn(),
  }
}));

// Mock the API
vi.mock('../src/services/api', () => ({
  postExplainStream: vi.fn().mockResolvedValue(undefined)
}));

// Mock the travel state
vi.mock('../src/store/travelState', () => ({
  startTravel: vi.fn(),
  isTravelling: vi.fn().mockReturnValue(true)
}));

// Mock the general store
vi.mock('../src/store', () => ({
  currentFen: vi.fn().mockReturnValue('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'),
  setHoverAdvice: vi.fn(),
  setHoverEmotion: vi.fn(),
}));

describe('useTravelMode', () => {
  let listeners: Function[] = [];

  beforeEach(() => {
    vi.clearAllMocks();
    listeners = [];
    
    // Capture listeners added by useTravelMode
    vi.mocked(stockfishService.addListener).mockImplementation((fn) => {
      listeners.push(fn);
    });
    vi.mocked(stockfishService.removeListener).mockImplementation((fn) => {
      listeners = listeners.filter(l => l !== fn);
    });
  });

  const simulateWorkerMessage = (data: string) => {
    listeners.forEach(fn => fn({ data } as MessageEvent));
  };

  it('should ignore stray bestmove from previous searches and wait for the real one', async () => {
    const { activateTravel } = useTravelMode();
    
    const fen = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1';
    
    // Start travel mode (returns a promise we will await after simulating messages)
    const travelPromise = activateTravel(fen, 'e4');

    // 1. Simulate a stray bestmove from a PREVIOUS search arriving immediately
    simulateWorkerMessage('bestmove d2d4');

    // 2. Simulate readyok to flush the queue
    simulateWorkerMessage('readyok');

    // 3. Simulate the actual PV info for the NEW search
    simulateWorkerMessage('info depth 12 pv e7e5 g1f3 b8c6');
    
    // 4. Simulate the actual bestmove for the NEW search
    simulateWorkerMessage('bestmove e7e5 ponder g1f3');

    await travelPromise;

    // Verify it sent the right commands in the right order
    expect(stockfishService.send).toHaveBeenCalledWith('stop');
    expect(stockfishService.send).toHaveBeenCalledWith('isready');
    expect(stockfishService.send).toHaveBeenCalledWith('ucinewgame');
    expect(stockfishService.send).toHaveBeenCalledWith(`position fen ${fen}`);
    expect(stockfishService.send).toHaveBeenCalledWith('go depth 12');

    // Verify startTravel was called with the correct sequence of moves
    // e7e5, g1f3, b8c6
    expect(startTravel).toHaveBeenCalledTimes(2); // Once for initial lock, once for the actual travel
    
    const secondCallArgs = vi.mocked(startTravel).mock.calls[1];
    expect(secondCallArgs[1]).toEqual([
      null,
      { from: 'e7', to: 'e5' },
      { from: 'g1', to: 'f3' },
      { from: 'b8', to: 'c6' }
    ]);
  });
});
