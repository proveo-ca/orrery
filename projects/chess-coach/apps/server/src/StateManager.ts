import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const STARTING_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

function resolveStatePath(fileName: string): string {
  const dir = (process.env.CHESS_STATE_DIR ?? "").trim();
  return dir === "" ? fileName : `${dir}/${fileName}`;
}

/**
 * File-backed FEN state, mirroring the Kotlin StateManager + StateReader
 * (_spec/api/behavior.md §8). Honors CHESS_STATE_DIR.
 */
export class StateManager {
  readonly startingFen = STARTING_FEN;

  constructor(private readonly fenFilePath: string = resolveStatePath("game_state.fen")) {}

  readFen(): string {
    if (existsSync(this.fenFilePath)) {
      return readFileSync(this.fenFilePath, "utf8").trim();
    }
    return STARTING_FEN;
  }

  writeFen(fen: string): void {
    const dir = dirname(this.fenFilePath);
    if (dir && dir !== "." && !existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(this.fenFilePath, fen);
  }

  resetGame(): void {
    this.writeFen(STARTING_FEN);
  }
}
