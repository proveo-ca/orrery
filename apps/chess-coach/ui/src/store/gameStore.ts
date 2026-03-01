import { createSignal } from 'solid-js';

const STARTING_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export type CoachEmotion = 'idle' | 'watching' | 'thinking' | 'happy' | 'shocked';
export type PlayerColorPref = 'w' | 'b' | 'random';

export const [fenHistory, setFenHistory] = createSignal<string[]>([STARTING_FEN]);
export const [currentIndex, setCurrentIndex] = createSignal<number>(0);
export const [advice, setAdvice] = createSignal<string>("Welcome! Make a move to get started.");
export const [adviceHoveredSquares, setAdviceHoveredSquares] = createSignal<string[]>([]);

// Custom Coach Emotion State with Auto-Reset
const [_coachEmotion, _setCoachEmotion] = createSignal<CoachEmotion>('idle');
export const coachEmotion = _coachEmotion;

let emotionTimeout: number | undefined;

export const setCoachEmotion = (emotion: CoachEmotion, autoResetMs?: number) => {
  _setCoachEmotion(emotion);
  
  if (emotionTimeout) {
    clearTimeout(emotionTimeout);
    emotionTimeout = undefined;
  }
  
  if (autoResetMs) {
    emotionTimeout = window.setTimeout(() => {
      if (_coachEmotion() === emotion) {
        _setCoachEmotion('idle');
      }
    }, autoResetMs);
  }
};

// Color Selection State
export const [colorPref, setColorPref] = createSignal<PlayerColorPref>('w');
export const [activePlayerColor, setActivePlayerColor] = createSignal<'w' | 'b'>('w');

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
  
  // Resolve random color
  let nextColor: 'w' | 'b' = 'w';
  if (colorPref() === 'random') {
    nextColor = Math.random() > 0.5 ? 'w' : 'b';
  } else {
    nextColor = colorPref() as 'w' | 'b';
  }
  setActivePlayerColor(nextColor);
  
  if (nextColor === 'w') {
    setAdvice("New game started. You play White. Your move!");
  } else {
    setAdvice("New game started. You play Black. I'm thinking...");
  }
  
  setCoachEmotion('happy', 2000);
};
