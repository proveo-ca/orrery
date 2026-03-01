import { createSignal } from 'solid-js';

const STARTING_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export type CoachEmotion = 'idle' | 'watching' | 'thinking' | 'happy' | 'shocked';

export const [fenHistory, setFenHistory] = createSignal<string[]>([STARTING_FEN]);
export const [currentIndex, setCurrentIndex] = createSignal<number>(0);
export const [advice, setAdvice] = createSignal<string>("Welcome! Make a move to get started.");
export const [isCoachMode, setIsCoachMode] = createSignal<boolean>(true);
export const [coachEmotion, setCoachEmotion] = createSignal<CoachEmotion>('idle');

// NEW: Track squares hovered in the advice panel
export const [adviceHoveredSquares, setAdviceHoveredSquares] = createSignal<string[]>([]);

export const currentFen = () => fenHistory()[currentIndex()];

export const addMoveToHistory = (newFen: string) => {
  const history = fenHistory().slice(0, currentIndex() + 1);
  setFenHistory([...history, newFen]);
  setCurrentIndex(history.length);
};

export const goBack = () => {
  if (currentIndex() > 0) setCurrentIndex(currentIndex() - 1);
};

export const goForward = () => {
  if (currentIndex() < fenHistory().length - 1) setCurrentIndex(currentIndex() + 1);
};

export const resetGame = (fen: string = STARTING_FEN) => {
  setFenHistory([fen]);
  setCurrentIndex(0);
  setAdvice(isCoachMode() ? "New game started. Your move!" : "Solo mode. Play both sides!");
  setCoachEmotion('happy');
  setTimeout(() => setCoachEmotion('idle'), 2000);
};

export const toggleMode = () => {
  setIsCoachMode(!isCoachMode());
  setAdvice(isCoachMode() ? "Switched to Coach Mode. I will play Black." : "Switched to Solo Mode. You control both sides.");
  setCoachEmotion('shocked');
  setTimeout(() => setCoachEmotion('idle'), 2000);
};
