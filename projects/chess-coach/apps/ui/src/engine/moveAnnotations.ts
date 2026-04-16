import type { MoveRecord } from "~/store/gameHistoryStore";

export const BLUNDER_THRESHOLD_CP = -200;

export type AnnotationTag = "best" | "blunder" | "hint" | "forced";

/**
 * Pure annotation resolver. Combines the stored move records with
 * review-time Stockfish analysis (cpDeltas + wasBestMoves) to produce
 * a tag set per half-move.
 *
 * The "forced" rule (move is simultaneously best AND a blunder) retroactively
 * marks the previous HUMAN move as a blunder — two plies back, skipping the
 * AI's reply.
 */
export function resolveAnnotations(
  moves: MoveRecord[],
  cpDeltas: (number | null)[],
  wasBestMoves: boolean[],
): AnnotationTag[][] {
  const tags: AnnotationTag[][] = moves.map(() => []);

  moves.forEach((m, i) => {
    if (m.isAI) return;
    const cp = cpDeltas[i] ?? null;
    const best = wasBestMoves[i] ?? false;
    const isBlunder = cp != null && cp <= BLUNDER_THRESHOLD_CP;
    const isForced = best && isBlunder;

    if (isForced) {
      tags[i].push("forced");
      const prevHuman = i - 2;
      if (prevHuman >= 0 && !moves[prevHuman].isAI) {
        const prior = tags[prevHuman];
        const bestIdx = prior.indexOf("best");
        if (bestIdx !== -1) prior.splice(bestIdx, 1);
        if (!prior.includes("blunder")) prior.push("blunder");
      }
    } else if (best && cp != null && cp > BLUNDER_THRESHOLD_CP) {
      tags[i].push("best");
    } else if (isBlunder) {
      tags[i].push("blunder");
    }

    if (m.hasPressedHint) tags[i].push("hint");
  });

  return tags;
}

/** Format a centipawn delta as a signed display string. */
export function formatCp(cp: number): string {
  if (cp >= 10000) return "M+";
  if (cp <= -10000) return "M-";
  return cp > 0 ? `+${cp}` : `${cp}`;
}

export type MoveRow = {
  turn: number;
  white: MoveRecord | null;
  whiteIndex: number;
  black: MoveRecord | null;
  blackIndex: number;
};

/**
 * Pair a flat half-move list into `{ turn, white, black }` rows suitable
 * for two-column rendering. Handles games where black moves first (FEN
 * with " b " side-to-move).
 */
export function pairMovesIntoRows(moves: MoveRecord[], startingFen: string): MoveRow[] {
  const out: MoveRow[] = [];
  const startsWithBlack = / b /.test(startingFen.slice(0, 80));
  for (let i = 0; i < moves.length; i++) {
    const turn = Math.floor((i + (startsWithBlack ? 1 : 0)) / 2) + 1;
    const isWhite = ((i + (startsWithBlack ? 1 : 0)) & 1) === 0;
    if (isWhite) {
      out.push({ turn, white: moves[i], whiteIndex: i, black: null, blackIndex: -1 });
    } else {
      const last = out[out.length - 1];
      if (last && last.turn === turn) {
        last.black = moves[i];
        last.blackIndex = i;
      } else {
        out.push({ turn, white: null, whiteIndex: -1, black: moves[i], blackIndex: i });
      }
    }
  }
  return out;
}
