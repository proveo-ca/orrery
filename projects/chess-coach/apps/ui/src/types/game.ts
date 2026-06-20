import type { PlayerIdentity } from "~/types/settings";

export type MoveSquares = { from: string; to: string };

export type MoveRecord = {
  san: string;
  hasPressedHint: boolean;
  isAI: boolean;
};

export type GameResult = "win" | "loss" | "draw" | "ongoing";

export type GameRecord = {
  id: string;
  startedAt: string;
  endedAt: string | null;
  result: GameResult;
  pgn: string;
  startingFen: string;
  playerColor: "w" | "b";
  difficulty: string;
  moves: MoveRecord[];
  playerRace?: PlayerIdentity;
  opponentRace?: PlayerIdentity;
  opponentName?: string;
};
