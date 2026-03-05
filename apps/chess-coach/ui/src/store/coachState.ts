import { createStore } from 'solid-js/store';

export type CoachEmotion =
  | 'idle'
  | 'watching'
  | 'thinking'
  | 'happy'
  | 'shocked'
  | 'sleepy'
  | 'sleeping';

type CoachState = {
  // "base" state (driven by game events / API)
  baseAdvice: string;
  baseCoachEmotion: CoachEmotion;

  // "hover override" state (driven by board hover / evaluation)
  hoverAdvice: string | null;
  hoverCoachEmotion: CoachEmotion | null;

  adviceHoveredSquares: string[];
  thinkingPhrases: string[];
  bestMovePhrases: string[];

  // Whether the hover eval detected a blunder (drives "Why?" button)
  hoverBlunder: boolean;
  hoverBlunderFen: string | null;
};

const [coachState, setCoachState] = createStore<CoachState>({
  baseAdvice: 'Zzz...',
  baseCoachEmotion: 'sleeping',

  hoverAdvice: null,
  hoverCoachEmotion: null,

  adviceHoveredSquares: [],
  thinkingPhrases: ['Hmm...'],
  bestMovePhrases: ['Great move!'],

  hoverBlunder: false,
  hoverBlunderFen: null,
});

// ===== Selectors (UI reads these; hover override wins) =====
export const baseAdvice = () => coachState.baseAdvice;
export const advice = () => coachState.hoverAdvice ?? coachState.baseAdvice;

export const baseCoachEmotion = () => coachState.baseCoachEmotion;
export const coachEmotion = () => coachState.hoverCoachEmotion ?? coachState.baseCoachEmotion;

export const adviceHoveredSquares = () => coachState.adviceHoveredSquares;
export const thinkingPhrases = () => coachState.thinkingPhrases;
export const bestMovePhrases = () => coachState.bestMovePhrases;

export const hoverBlunder = () => coachState.hoverBlunder;
export const hoverBlunderFen = () => coachState.hoverBlunderFen;

// ===== Base setters =====
export const setAdvice = (val: string) => setCoachState('baseAdvice', val);
export const setAdviceHoveredSquares = (squares: string[]) => setCoachState('adviceHoveredSquares', squares);

export const setThinkingPhrases = (phrases: string[]) => setCoachState('thinkingPhrases', phrases);
export const setBestMovePhrases = (phrases: string[]) => setCoachState('bestMovePhrases', phrases);

// ===== Hover override setters =====
export const setHoverAdvice = (val: string | null) => setCoachState('hoverAdvice', val);
export const setHoverEmotion = (val: CoachEmotion | null) => setCoachState('hoverCoachEmotion', val);

export const setHoverBlunder = (isBlunder: boolean, fen: string | null = null) => {
  setCoachState('hoverBlunder', isBlunder);
  setCoachState('hoverBlunderFen', fen);
};

export const clearHoverOverride = () => {
  setCoachState({
    hoverAdvice: null,
    hoverCoachEmotion: null,
    hoverBlunder: false,
    hoverBlunderFen: null,
  });
};

// ===== Base Coach Emotion with Auto-Reset =====
let emotionTimeout: number | undefined;

export const setCoachEmotion = (emotion: CoachEmotion, autoResetMs?: number) => {
  setCoachState('baseCoachEmotion', emotion);

  if (emotionTimeout) {
    clearTimeout(emotionTimeout);
    emotionTimeout = undefined;
  }

  if (autoResetMs) {
    emotionTimeout = window.setTimeout(() => {
      if (coachState.baseCoachEmotion === emotion) {
        setCoachState('baseCoachEmotion', 'idle');
      }
    }, autoResetMs);
  }
};

// ===== Event Dispatcher =====
export type CoachEvent = 
  | { type: 'APP_READY' }
  | { type: 'APP_ERROR' }
  | { type: 'NEW_GAME' }
  | { type: 'HUMAN_MOVE_BEST' }
  | { type: 'HUMAN_MOVE_NORMAL' }
  | { type: 'AI_THINKING' }
  | { type: 'AI_MOVED' }
  | { type: 'AI_ERROR' }
  | { type: 'GAME_OVER'; result: 'win' | 'loss' | 'draw' }
  | { type: 'ADVICE_RECEIVED'; isBlunder: boolean }
  | { type: 'SLEEPY' }
  | { type: 'SLEEPING' }
  | { type: 'WAKE_UP' };

export const dispatchCoachEvent = (event: CoachEvent) => {
  switch (event.type) {
    case 'APP_READY':
    case 'AI_MOVED':
    case 'WAKE_UP':
      setCoachEmotion('idle');
      break;
    case 'APP_ERROR':
      setCoachEmotion('shocked');
      break;
    case 'NEW_GAME':
      setCoachEmotion('happy', 2000);
      break;
    case 'HUMAN_MOVE_BEST':
      setCoachEmotion('happy'); // Stays happy until AI moves
      break;
    case 'HUMAN_MOVE_NORMAL':
    case 'AI_THINKING':
      setCoachEmotion('thinking');
      break;
    case 'AI_ERROR':
      setCoachEmotion('shocked', 3000);
      break;
    case 'GAME_OVER':
      if (event.result === 'win') setCoachEmotion('shocked');
      else if (event.result === 'loss') setCoachEmotion('happy');
      else setCoachEmotion('sleepy');
      break;
    case 'ADVICE_RECEIVED':
      if (event.isBlunder) setCoachEmotion('shocked', 3000);
      else setCoachEmotion('idle');
      break;
    case 'SLEEPY':
      setCoachEmotion('sleepy');
      break;
    case 'SLEEPING':
      setCoachEmotion('sleeping');
      break;
  }
};
