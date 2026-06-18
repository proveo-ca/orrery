import { capabilities } from "~/store/capabilitiesStore";
import { createPersistedStore } from "~/store/createPersistedStore";

export type PlayerColorPref = "w" | "b" | "random";
export type Difficulty = "intermediate" | "advanced" | "expert";
export type PieceSet = "cburnett" | "selena" | "gord" | "manuel";
export type PlayerIdentity = "Human" | "Cat" | "Dog" | "Rat";

export const DEFAULT_OPPONENT_PIECE_SET: PieceSet = "selena";

/**
 * Centipawn loss at which a move counts as a blunder, per difficulty.
 * Stronger settings are stricter (a smaller drop already counts). Values are
 * negative because they are compared against a signed cpDelta (delta <= threshold).
 */
export const BLUNDER_THRESHOLD_CP_BY_DIFFICULTY: Record<Difficulty, number> = {
  intermediate: -200,
  advanced: -150,
  expert: -80,
};

/**
 * How the coach names a threshold-crossing move per difficulty. The same loss
 * is held to a higher standard as the player improves: a 200cp drop is a
 * "blunder" for an intermediate, while an expert is pulled up on an 80cp drop
 * as merely "an inaccuracy". Includes the article so "is {label}" reads
 * naturally ("is a blunder" / "is an inaccuracy").
 */
export const BLUNDER_LABEL_BY_DIFFICULTY: Record<Difficulty, string> = {
  intermediate: "a blunder",
  advanced: "a mistake",
  expert: "an inaccuracy",
};

export const IDENTITY_TO_PIECE_SET: Record<PlayerIdentity, PieceSet> = {
  Human: "cburnett",
  Cat: "selena",
  Dog: "gord",
  Rat: "manuel",
};

const [settingsState, setSettingsState] = createPersistedStore("chess_coach_settings_state", {
  colorPref: "w" as PlayerColorPref,
  activePlayerColor: "w" as "w" | "b",
  difficulty: "intermediate" as Difficulty,
  playerIdentity: "Human" as PlayerIdentity,
  opponentIdentity: "Cat" as PlayerIdentity,
  imLost: true,
});

export const colorPref = () => settingsState.colorPref;
export const activePlayerColor = () => settingsState.activePlayerColor;
export const difficulty = () => settingsState.difficulty;
export const blunderThresholdCp = () =>
  BLUNDER_THRESHOLD_CP_BY_DIFFICULTY[settingsState.difficulty];
export const blunderLabel = () => BLUNDER_LABEL_BY_DIFFICULTY[settingsState.difficulty];
export const playerIdentity = () => settingsState.playerIdentity;
export const opponentIdentity = () => settingsState.opponentIdentity;
export const imLost = () => settingsState.imLost;
export const playerPieceSet = (): PieceSet =>
  settingsState.imLost ? "cburnett" : IDENTITY_TO_PIECE_SET[settingsState.playerIdentity];
export const opponentPieceSet = (): PieceSet => {
  if (settingsState.imLost) return "cburnett";
  if (capabilities().opponentUsesPlayerPieceSet) {
    return IDENTITY_TO_PIECE_SET[settingsState.playerIdentity];
  }
  return IDENTITY_TO_PIECE_SET[settingsState.opponentIdentity];
};

export const setColorPref = (val: PlayerColorPref) => setSettingsState("colorPref", val);
export const setActivePlayerColor = (val: "w" | "b") => setSettingsState("activePlayerColor", val);
export const setDifficulty = (val: Difficulty) => setSettingsState("difficulty", val);
export const setPlayerIdentity = (val: PlayerIdentity) => setSettingsState("playerIdentity", val);
export const setOpponentIdentity = (val: PlayerIdentity) =>
  setSettingsState("opponentIdentity", val);
export const setImLost = (val: boolean) => setSettingsState("imLost", val);
