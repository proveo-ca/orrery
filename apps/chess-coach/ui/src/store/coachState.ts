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
};

const [coachState, setCoachState] = createStore<CoachState>({
  baseAdvice: 'Zzz...',
  baseCoachEmotion: 'sleeping',

  hoverAdvice: null,
  hoverCoachEmotion: null,

  adviceHoveredSquares: [],
  thinkingPhrases: ['Hmm...'],
  bestMovePhrases: ['Great move!']
});

// ===== Selectors (UI reads these; hover override wins) =====
export const baseAdvice = () => coachState.baseAdvice;
export const advice = () => coachState.hoverAdvice ?? coachState.baseAdvice;

export const baseCoachEmotion = () => coachState.baseCoachEmotion;
export const coachEmotion = () => coachState.hoverCoachEmotion ?? coachState.baseCoachEmotion;

export const adviceHoveredSquares = () => coachState.adviceHoveredSquares;
export const thinkingPhrases = () => coachState.thinkingPhrases;
export const bestMovePhrases = () => coachState.bestMovePhrases;

// ===== Base setters =====
export const setAdvice = (val: string) => setCoachState('baseAdvice', val);
export const setAdviceHoveredSquares = (squares: string[]) => setCoachState('adviceHoveredSquares', squares);

export const setThinkingPhrases = (phrases: string[]) => setCoachState('thinkingPhrases', phrases);
export const setBestMovePhrases = (phrases: string[]) => setCoachState('bestMovePhrases', phrases);

// ===== Hover override setters =====
export const setHoverAdvice = (val: string | null) => setCoachState('hoverAdvice', val);
export const setHoverEmotion = (val: CoachEmotion | null) => setCoachState('hoverCoachEmotion', val);

export const clearHoverOverride = () => {
  setCoachState({
    hoverAdvice: null,
    hoverCoachEmotion: null
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
