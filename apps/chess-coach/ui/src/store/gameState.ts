import { createPersistedStore } from './createPersistedStore';
import { colorPref, setActivePlayerColor } from './settingsState';
import { setAdvice, setCoachEmotion } from './coachState';

const STARTING_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export type MoveSquares = { from: string; to: string };

const [gameState, setGameState] = createPersistedStore('chess_coach_game_state', {
  fenHistory: [STARTING_FEN] as string[],
  moveHistory: [] as (MoveSquares | null)[],
  currentIndex: 0
});

export const fenHistory = () => gameState.fenHistory;
export const moveHistory = () => gameState.moveHistory;
export const currentIndex = () => gameState.currentIndex;

export const setFenHistory = (val: string[]) => setGameState('fenHistory', val);
export const setMoveHistory = (val: (MoveSquares | null)[]) => setGameState('moveHistory', val);
export const setCurrentIndex = (val: number) => setGameState('currentIndex', val);

export const currentFen = () => gameState.fenHistory[gameState.currentIndex];

export const addMoveToHistory = (newFen: string, move?: MoveSquares) => {
  const history = gameState.fenHistory.slice(0, gameState.currentIndex + 1);
  const mHistory = gameState.moveHistory.slice(0, gameState.currentIndex);

  setGameState('fenHistory', [...history, newFen]);
  setGameState('moveHistory', [...mHistory, move ?? null]);
  setGameState('currentIndex', history.length);
};

export const goBack = () => {
  if (gameState.currentIndex > 0) setGameState('currentIndex', gameState.currentIndex - 1);
};

export const goForward = () => {
  if (gameState.currentIndex < gameState.fenHistory.length - 1) {
    setGameState('currentIndex', gameState.currentIndex + 1);
  }
};

export const resetGame = (fen: string = STARTING_FEN) => {
  setGameState({
    fenHistory: [fen],
    moveHistory: [],
    currentIndex: 0
  });

  // Resolve random color
  let nextColor: 'w' | 'b' = 'w';
  const pref = colorPref();
  if (pref === 'random') {
    nextColor = Math.random() > 0.5 ? 'w' : 'b';
  } else {
    nextColor = pref;
  }
  setActivePlayerColor(nextColor);

  if (nextColor === 'w') {
    setAdvice('New game! You play White. Your move!');
  } else {
    setAdvice("New game! You play Black. I'm thinking...");
  }

  setCoachEmotion('happy', 2000);
};
