import type { GameRecord } from "~/types/game";

const colorWord = (c: "w" | "b"): string => (c === "w" ? "White" : "Black");

// Strip a trailing " (...)" annotation from legacy opponent names that were
// stored as "Selena (Intermediate)" before the difficulty was split off.
const baseName = (s: string): string => s.replace(/\s*\([^)]*\)\s*$/, "").trim();

/**
 * Human-readable label for a recorded game, e.g. "Juan (White) vs Selena (Black)".
 * The player's name is user-supplied (the browser exposes no usable identity);
 * it falls back to "You" when unset. Colors are derived from `playerColor`.
 */
export const formatGameLabel = (g: GameRecord): string => {
  const player = g.playerName?.trim() || "You";
  const opponent = baseName(g.opponentName || g.opponentRace || "Selena");
  const opponentColor: "w" | "b" = g.playerColor === "w" ? "b" : "w";
  return `${player} (${colorWord(g.playerColor)}) vs ${opponent} (${colorWord(opponentColor)})`;
};
