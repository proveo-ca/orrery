import { createSignal } from "solid-js";

/**
 * Per-screen capability descriptor. Each screen sets its capabilities on
 * mount; hooks and components read the specific flags they care about
 * instead of branching on a single mode boolean.
 *
 * Kept in a dedicated module so `settingsStore` can depend on it without
 * risking a circular import with `gameStore`.
 */
export type ScreenCapabilities = {
  // UI affordances
  hint: boolean; // show hint button
  travel: boolean; // space-bar time-travel on blunders
  evalBarAlwaysVisible: boolean; // eval bar visible during live play

  // Engine / coach behavior
  aiOpponent: boolean; // AI responds + advice after human move
  blunderDetection: boolean; // hover blunder detection + shocked emotion
  continuousAnalysis: boolean; // stockfish runs even when not player's turn
  showBestMove: boolean; // continuous best-move highlight overlay

  // Board interaction
  historyBranching: boolean; // past-history moves branch instead of lock UI
  freeColorControl: boolean; // can touch any color on its turn
  readOnly: boolean; // disables all piece interaction (used by ReviewScreen)

  // Visual
  opponentUsesPlayerPieceSet: boolean; // both sides render with player's piece set
};

export const COACH_CAPABILITIES: ScreenCapabilities = {
  hint: true,
  travel: true,
  evalBarAlwaysVisible: false,
  aiOpponent: true,
  blunderDetection: true,
  continuousAnalysis: false,
  showBestMove: false,
  historyBranching: false,
  freeColorControl: false,
  readOnly: false,
  opponentUsesPlayerPieceSet: false,
};

export const ANALYSIS_CAPABILITIES: ScreenCapabilities = {
  hint: false,
  travel: false,
  evalBarAlwaysVisible: true,
  aiOpponent: false,
  blunderDetection: false,
  continuousAnalysis: true,
  showBestMove: true,
  historyBranching: true,
  freeColorControl: true,
  readOnly: false,
  opponentUsesPlayerPieceSet: true,
};

export const REVIEW_CAPABILITIES: ScreenCapabilities = {
  hint: false,
  travel: false,
  evalBarAlwaysVisible: true,
  aiOpponent: false,
  blunderDetection: false,
  continuousAnalysis: true,
  showBestMove: false,
  // historyBranching=true so past-position navigation doesn't lock the UI
  // behind the replay overlay — the user IS navigating past positions.
  historyBranching: true,
  freeColorControl: false,
  readOnly: true,
  opponentUsesPlayerPieceSet: true,
};

export const [capabilities, setCapabilities] = createSignal<ScreenCapabilities>(COACH_CAPABILITIES);
