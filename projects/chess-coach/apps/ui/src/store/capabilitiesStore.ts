import { createSignal } from "solid-js";

import { resolveMode } from "~/services/runtimeMode";

/**
 * Per-screen capability descriptor. Each screen sets its capabilities on
 * mount; hooks and components read the specific flags they care about
 * instead of branching on a single mode boolean.
 *
 * Kept in a dedicated module so `settingsStore` can depend on it without
 * risking a circular import with `gameStore`.
 */
/**
 * Best-move arrow overlay mode:
 *   - "off"         — never shown
 *   - "player-only" — only on the human (activePlayerColor) turn (review of a
 *                     human-vs-AI game: advice is for the human, not the AI reply)
 *   - "both"        — best move for whichever side is to move (free analysis)
 */
export type BestMoveArrowMode = "off" | "player-only" | "both";

export type ScreenCapabilities = {
  // UI affordances
  hint: boolean; // show hint button
  travel: boolean; // space-bar time-travel on blunders
  historyNav: boolean; // show move-history back/forward navigation
  evalBarAlwaysVisible: boolean; // eval bar visible during live play

  // Engine / coach behavior
  aiOpponent: boolean; // AI responds + advice after human move
  blunderDetection: boolean; // hover blunder detection + shocked emotion
  continuousAnalysis: boolean; // stockfish runs even when not player's turn
  bestMoveArrow: BestMoveArrowMode; // continuous best-move arrow overlay mode
  commentary: boolean; // LLM-generated move commentary

  // Persistence
  persistGame: boolean; // moves write to localStorage (Coach only)

  // Board interaction
  historyBranching: boolean; // past-history moves branch instead of lock UI
  freeColorControl: boolean; // can touch any color on its turn
  readOnly: boolean; // disables all piece interaction (used by ReviewScreen)

  // Visual
  opponentUsesPlayerPieceSet: boolean; // both sides render with player's piece set
  flipBoard: boolean; // show flip board button
};

const hasLlm = resolveMode().kind !== "web-no-llm";

export const COACH_CAPABILITIES: ScreenCapabilities = {
  hint: true,
  travel: true,
  historyNav: true,
  evalBarAlwaysVisible: false,
  aiOpponent: true,
  blunderDetection: true,
  continuousAnalysis: false,
  bestMoveArrow: "off",
  commentary: hasLlm,
  persistGame: true,
  historyBranching: false,
  freeColorControl: false,
  readOnly: false,
  opponentUsesPlayerPieceSet: false,
  flipBoard: false,
};

export const ANALYSIS_CAPABILITIES: ScreenCapabilities = {
  hint: false,
  travel: false,
  historyNav: true,
  evalBarAlwaysVisible: true,
  aiOpponent: false,
  blunderDetection: false,
  continuousAnalysis: true,
  bestMoveArrow: "both", // free analysis: best move for whichever side moves
  commentary: hasLlm,
  persistGame: false,
  historyBranching: true,
  freeColorControl: true,
  readOnly: false,
  opponentUsesPlayerPieceSet: true,
  flipBoard: true,
};

export const REVIEW_CAPABILITIES: ScreenCapabilities = {
  hint: false,
  travel: false,
  historyNav: false,
  evalBarAlwaysVisible: true,
  aiOpponent: false,
  blunderDetection: false,
  continuousAnalysis: true,
  // "off" by default; ReviewScreen flips it to "player-only" in branch mode.
  bestMoveArrow: "off",
  commentary: hasLlm,
  persistGame: false,
  // historyBranching=true so past-position navigation doesn't lock the UI
  // behind the replay overlay — the user IS navigating past positions.
  historyBranching: true,
  freeColorControl: false,
  readOnly: false,
  opponentUsesPlayerPieceSet: false,
  flipBoard: false,
};

export const [capabilities, setCapabilities] = createSignal<ScreenCapabilities>(COACH_CAPABILITIES);
