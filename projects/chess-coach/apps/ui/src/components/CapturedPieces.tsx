import clsx from "clsx";
import { type Component, createMemo } from "solid-js";

import styles from "~/components/CapturedPieces.module.css";
import { currentFen } from "~/store/gameStore";
import { activePlayerColor } from "~/store/settingsStore";
import { isTravelling, travelFen } from "~/store/travelStore";

const START_COUNTS: Record<string, number> = {
  P: 8,
  N: 2,
  B: 2,
  R: 2,
  Q: 1,
  p: 8,
  n: 2,
  b: 2,
  r: 2,
  q: 1,
};

const VALUES: Record<string, number> = {
  P: 1,
  N: 3,
  B: 3,
  R: 5,
  Q: 9,
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
};

// Use filled shapes for all pieces so we can color them via CSS
const UNICODE_PIECES: Record<string, string> = {
  P: "\u265F",
  N: "\u265E",
  B: "\u265D",
  R: "\u265C",
  Q: "\u265B",
  p: "\u265F",
  n: "\u265E",
  b: "\u265D",
  r: "\u265C",
  q: "\u265B",
};

// Sort order: Queens first, then Rooks, Bishops, Knights, Pawns
const SORT_ORDER = ["Q", "R", "B", "N", "P", "q", "r", "b", "n", "p"];

function useCaptureStats() {
  const activeFen = createMemo(() => (isTravelling() ? travelFen() : currentFen()));

  return createMemo(() => {
    const fen = activeFen().split(" ")[0];
    const counts: Record<string, number> = {
      P: 0,
      N: 0,
      B: 0,
      R: 0,
      Q: 0,
      p: 0,
      n: 0,
      b: 0,
      r: 0,
      q: 0,
    };

    for (const char of fen) {
      if (counts[char] !== undefined) counts[char]++;
    }

    const capturedWhite: string[] = [];
    const capturedBlack: string[] = [];
    let whiteMat = 0;
    let blackMat = 0;

    for (const p of Object.keys(START_COUNTS)) {
      const isWhite = p === p.toUpperCase();
      const countOnBoard = counts[p];
      const capturedCount = START_COUNTS[p] - countOnBoard;

      if (isWhite) {
        whiteMat += countOnBoard * VALUES[p];
        for (let i = 0; i < capturedCount; i++) capturedWhite.push(p);
      } else {
        blackMat += countOnBoard * VALUES[p];
        for (let i = 0; i < capturedCount; i++) capturedBlack.push(p);
      }
    }

    capturedWhite.sort((a, b) => SORT_ORDER.indexOf(a) - SORT_ORDER.indexOf(b));
    capturedBlack.sort((a, b) => SORT_ORDER.indexOf(a) - SORT_ORDER.indexOf(b));

    const humanColor = activePlayerColor();
    const aiColor = humanColor === "w" ? "b" : "w";

    const aiCaptured = aiColor === "b" ? capturedWhite : capturedBlack;
    const humanCaptured = humanColor === "b" ? capturedWhite : capturedBlack;

    const aiMat = aiColor === "b" ? blackMat : whiteMat;
    const humanMat = humanColor === "b" ? blackMat : whiteMat;

    return {
      aiCaptured,
      humanCaptured,
      aiAdvantage: aiMat - humanMat,
      humanAdvantage: humanMat - aiMat,
    };
  });
}

function renderPieces(pieces: string[]) {
  return pieces.map((p) => {
    const isWhite = p === p.toUpperCase();
    return (
      <span class={isWhite ? styles["white-piece"] : styles["black-piece"]}>
        {UNICODE_PIECES[p]}
      </span>
    );
  });
}

/** Opponent's captured pieces — top left of the board */
export const OpponentCaptures: Component = () => {
  const stats = useCaptureStats();

  return (
    <div class={clsx(styles.captures, styles["captures--left"])}>
      {renderPieces(stats().aiCaptured)}
      {stats().aiAdvantage > 0 && <span class={styles.advantage}>+{stats().aiAdvantage}</span>}
    </div>
  );
};

/** Player's captured pieces — bottom right of the board */
export const PlayerCaptures: Component = () => {
  const stats = useCaptureStats();

  return (
    <div class={clsx(styles.captures, styles["captures--right"])}>
      {stats().humanAdvantage > 0 && (
        <span class={styles.advantage}>+{stats().humanAdvantage}</span>
      )}
      {renderPieces(stats().humanCaptured)}
    </div>
  );
};
