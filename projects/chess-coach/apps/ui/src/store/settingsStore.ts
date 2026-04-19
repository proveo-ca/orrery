// SPEC: _spec/chess-coach/ui/components.puml
import { capabilities } from "~/store/capabilitiesStore";
import { createPersistedStore } from "~/store/createPersistedStore";

export type PlayerColorPref = "w" | "b" | "random";
export type Difficulty = "intermediate" | "advanced" | "expert";
export type PieceSet = "cburnett" | "selena" | "gord" | "manuel";
export type PlayerIdentity = "Human" | "Cat" | "Dog" | "Rat";

export const DEFAULT_OPPONENT_PIECE_SET: PieceSet = "selena";

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
  imLost: true,
});

export const colorPref = () => settingsState.colorPref;
export const activePlayerColor = () => settingsState.activePlayerColor;
export const difficulty = () => settingsState.difficulty;
export const playerIdentity = () => settingsState.playerIdentity;
export const imLost = () => settingsState.imLost;
export const playerPieceSet = (): PieceSet =>
  settingsState.imLost ? "cburnett" : IDENTITY_TO_PIECE_SET[settingsState.playerIdentity];
export const opponentPieceSet = (): PieceSet => {
  if (settingsState.imLost) return "cburnett";
  // When the screen lets the player drive both sides (Solo Analysis),
  // render the opponent with the player's piece set too.
  if (capabilities().opponentUsesPlayerPieceSet) {
    return IDENTITY_TO_PIECE_SET[settingsState.playerIdentity];
  }
  return DEFAULT_OPPONENT_PIECE_SET;
};

export const setColorPref = (val: PlayerColorPref) => setSettingsState("colorPref", val);
export const setActivePlayerColor = (val: "w" | "b") => setSettingsState("activePlayerColor", val);
export const setDifficulty = (val: Difficulty) => setSettingsState("difficulty", val);
export const setPlayerIdentity = (val: PlayerIdentity) => setSettingsState("playerIdentity", val);
export const setImLost = (val: boolean) => setSettingsState("imLost", val);
