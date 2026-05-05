// SPEC: _spec/chess-coach/ui/components.puml
import { createEffect, createRoot, createSignal } from "solid-js";
import { createStore } from "solid-js/store";
export type CoachEmotion =
  | "idle"
  | "watching"
  | "watching--left"
  | "watching--right"
  | "thinking"
  | "happy"
  | "shocked"
  | "sleepy"
  | "sleeping";

type CoachState = {
  // "base" state (driven by game events / API)
  baseAdvice: string;
  baseCoachEmotion: CoachEmotion;

  // "hover override" state (driven by board hover / evaluation)
  hoverAdvice: string | null;
  hoverCoachEmotion: CoachEmotion | null;

  adviceHoveredSquares: string[];
  adviceArrow: { from: string; to: string } | null;
  thinkingPhrases: string[];
  bestMovePhrases: string[];

  // Whether the hover eval detected a blunder (drives "Why?" button)
  hoverBlunder: boolean;
  hoverBlunderFen: string | null;
  hoverBlunderSan: string | null;

  // Survives clearHoverOverride so mobile users can tap "Why?" after dropping
  // the piece. Stores the pre-blunder FEN because currentFen() will have
  // advanced once the blunder move is made.
  pendingTravel: { blunderFen: string; blunderSan: string; fenBefore: string } | null;

  // Loading state
  llmProgress: number;
  llmLoadingText: string;
  isAppReady: boolean;
};

const [coachState, setCoachState] = createStore<CoachState>({
  baseAdvice: "Zzz...",
  baseCoachEmotion: "sleeping",

  hoverAdvice: null,
  hoverCoachEmotion: null,

  adviceHoveredSquares: [],
  adviceArrow: null as { from: string; to: string } | null,
  thinkingPhrases: ["Hmm..."],
  bestMovePhrases: ["Great move!"],

  hoverBlunder: false,
  hoverBlunderFen: null,
  hoverBlunderSan: null,
  pendingTravel: null,

  llmProgress: 0,
  llmLoadingText: "Waking up...",
  isAppReady: false,
});

// ===== Selectors (UI reads these; hover override wins) =====
export const baseAdvice = () => coachState.baseAdvice;
export const advice = () => coachState.hoverAdvice ?? coachState.baseAdvice;

export const baseCoachEmotion = () => coachState.baseCoachEmotion;
export const coachEmotion = () => coachState.hoverCoachEmotion ?? coachState.baseCoachEmotion;

export const adviceHoveredSquares = () => coachState.adviceHoveredSquares;
export const adviceArrow = () => coachState.adviceArrow;
export const thinkingPhrases = () => coachState.thinkingPhrases;
export const bestMovePhrases = () => coachState.bestMovePhrases;

export const hoverBlunder = () => coachState.hoverBlunder;
export const hoverBlunderFen = () => coachState.hoverBlunderFen;
export const hoverBlunderSan = () => coachState.hoverBlunderSan;
export const pendingTravel = () => coachState.pendingTravel;

export const llmProgress = () => coachState.llmProgress;
export const llmLoadingText = () => coachState.llmLoadingText;
export const isAppReady = () => coachState.isAppReady;

export const [showNewGame, setShowNewGame] = createSignal(false);
export const [showCredits, setShowCredits] = createSignal(false);
export const [showSettings, setShowSettings] = createSignal(false);

// ===== Base setters =====
export const setAdvice = (val: string) => setCoachState("baseAdvice", val);
export const setAdviceHoveredSquares = (squares: string[]) =>
  setCoachState("adviceHoveredSquares", squares);
export const setAdviceArrow = (arrow: { from: string; to: string } | null) =>
  setCoachState("adviceArrow", arrow);

export const setThinkingPhrases = (phrases: string[]) => setCoachState("thinkingPhrases", phrases);
export const setBestMovePhrases = (phrases: string[]) => setCoachState("bestMovePhrases", phrases);

export const setLlmProgress = (progress: number, text: string) => {
  setCoachState("llmProgress", progress);
  setCoachState("llmLoadingText", text);
};

// ===== Hover override setters =====
export const setHoverAdvice = (val: string | null) => setCoachState("hoverAdvice", val);
export const setHoverEmotion = (val: CoachEmotion | null) =>
  setCoachState("hoverCoachEmotion", val);

export const setHoverBlunder = (
  isBlunder: boolean,
  fen: string | null = null,
  san: string | null = null,
) => {
  setCoachState("hoverBlunder", isBlunder);
  setCoachState("hoverBlunderFen", fen);
  setCoachState("hoverBlunderSan", san);
};

export const setPendingTravel = (
  val: { blunderFen: string; blunderSan: string; fenBefore: string } | null,
) => setCoachState("pendingTravel", val);

export const clearPendingTravel = () => setCoachState("pendingTravel", null);

export const clearHoverOverride = () => {
  setCoachState({
    hoverAdvice: null,
    hoverCoachEmotion: null,
    hoverBlunder: false,
    hoverBlunderFen: null,
    hoverBlunderSan: null,
  });
};

// ===== Base Coach Emotion: state-coupled decay timer =====
//
// One timer, always synced to the displayed emotion. Each `setCoachEmotion`
// call cancels the prior decay and (optionally) schedules a fresh one — so
// stale closures from earlier moves cannot fire into an unrelated reactive
// graph. Decay writes go through `queueMicrotask` to keep them out of
// whatever tick the timer happened to land on.
//
// `dispatchCoachEvent` is a pure event → setCoachEmotion translator. It
// reads the current emotion to decide whether to override (e.g. preserve
// "happy" through HUMAN_MOVE_NORMAL) but never touches the timer directly.

let decayTimer: number | undefined;
let decayFromEmotion: CoachEmotion | null = null;

const clearDecay = () => {
  if (decayTimer !== undefined) {
    clearTimeout(decayTimer);
    decayTimer = undefined;
  }
  decayFromEmotion = null;
};

const scheduleDecay = (fromEmotion: CoachEmotion, holdMs: number) => {
  clearDecay();
  decayFromEmotion = fromEmotion;
  decayTimer = window.setTimeout(() => {
    decayTimer = undefined;
    const captured = decayFromEmotion;
    decayFromEmotion = null;
    // Defer the actual write so the reactive cascade doesn't run
    // synchronously inside this timer's macrotask. The previous
    // implementation was suspected of triggering a Solid runtime
    // recursion when "happy" → "idle" landed mid-Stockfish-info-storm.
    queueMicrotask(() => {
      if (coachState.baseCoachEmotion === captured) {
        setCoachState("baseCoachEmotion", "idle");
      }
    });
  }, holdMs);
};

export const setCoachEmotion = (emotion: CoachEmotion, autoResetMs?: number) => {
  console.log("[debug:coach] setCoachEmotion", { emotion, autoResetMs, prev: coachState.baseCoachEmotion });
  setCoachState("baseCoachEmotion", emotion);
  if (autoResetMs && emotion !== "idle") {
    scheduleDecay(emotion, autoResetMs);
  } else {
    clearDecay();
  }
};

// ===== Event Dispatcher (reducer-style) =====
export type CoachEvent =
  | { type: "APP_READY" }
  | { type: "APP_ERROR" }
  | { type: "NEW_GAME" }
  | { type: "HUMAN_MOVE_BEST" }
  | { type: "HUMAN_MOVE_NORMAL" }
  | { type: "AI_THINKING" }
  | { type: "AI_MOVED" }
  | { type: "AI_ERROR" }
  | { type: "GAME_OVER"; result: "win" | "loss" | "draw" }
  | { type: "ADVICE_RECEIVED"; isBlunder: boolean }
  | { type: "SLEEPY" }
  | { type: "SLEEPING" }
  | { type: "WAKE_UP" };

// Mirrors every dispatched event so passive listeners (e.g. the game
// recorder on CoachScreen) can react without the dispatcher needing to
// know about them. Subscribers use `on(lastCoachEvent, ...)`.
export const [lastCoachEvent, setLastCoachEvent] = createSignal<CoachEvent | null>(null);

export const dispatchCoachEvent = (event: CoachEvent) => {
  console.log("[debug:coach] dispatch", { event: event.type, cur: coachState.baseCoachEmotion });
  setLastCoachEvent(event);
  const cur = coachState.baseCoachEmotion;

  switch (event.type) {
    case "APP_READY":
      setCoachState("isAppReady", true);
      if (cur !== "happy") setCoachEmotion("idle");
      break;
    case "AI_MOVED":
    case "WAKE_UP":
      if (cur !== "happy") setCoachEmotion("idle");
      break;
    case "APP_ERROR":
      setCoachEmotion("shocked");
      break;
    case "NEW_GAME":
      setCoachEmotion("happy", 2000);
      break;
    case "HUMAN_MOVE_BEST":
      setCoachEmotion("happy", 3000);
      break;
    case "HUMAN_MOVE_NORMAL":
    case "AI_THINKING":
      // Preserve happy through subsequent normal moves / AI thinking.
      if (cur !== "happy") setCoachEmotion("thinking");
      break;
    case "AI_ERROR":
      setCoachEmotion("shocked", 3000);
      break;
    case "GAME_OVER":
      if (event.result === "win") setCoachEmotion("shocked");
      else if (event.result === "loss") setCoachEmotion("happy");
      else setCoachEmotion("sleepy");
      break;
    case "ADVICE_RECEIVED":
      if (event.isBlunder) setCoachEmotion("shocked", 3000);
      else setCoachEmotion("idle");
      break;
    case "SLEEPY":
      setCoachEmotion("sleepy");
      break;
    case "SLEEPING":
      setCoachEmotion("sleeping");
      break;
  }
};

// ===== Reactive Inactivity Timers =====
let sleepyTimer: number | undefined;
let sleepingTimer: number | undefined;

createRoot(() => {
  createEffect(() => {
    const current = coachEmotion();

    // Any emotion change (except falling asleep) resets the timers.
    if (current !== "sleepy" && current !== "sleeping") {
      if (sleepyTimer) clearTimeout(sleepyTimer);
      if (sleepingTimer) clearTimeout(sleepingTimer);

      sleepyTimer = window.setTimeout(() => {
        dispatchCoachEvent({ type: "SLEEPY" });
      }, 30000);

      sleepingTimer = window.setTimeout(() => {
        dispatchCoachEvent({ type: "SLEEPING" });
      }, 40000);
    }
  });
});

// ===== Focus Wake-Up =====
// When the user returns to the browser window (tab focus), wake the coach
// after a short delay. Without this, mouse-only interaction never wakes
// her and hover blunder detection stays dead after the sleep timer fires.
let focusWakeTimer: number | undefined;

window.addEventListener("focus", () => {
  clearTimeout(focusWakeTimer);
  focusWakeTimer = window.setTimeout(() => {
    const current = coachEmotion();
    if (current === "sleepy" || current === "sleeping") {
      dispatchCoachEvent({ type: "WAKE_UP" });
    }
  }, 1200);
});

window.addEventListener("blur", () => {
  clearTimeout(focusWakeTimer);
});
