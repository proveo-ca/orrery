// SPEC: _spec/chess-coach/ui/components.puml
import { Chess } from "chess.js";
import { For, Show, createEffect, createSignal, onCleanup } from "solid-js";
import type { Component } from "solid-js";

import styles from "~/components/features/CoachPanel.module.css";
import { useTravelMode } from "~/hooks/useTravelMode";
import {
  advice,
  hoverBlunder,
  hoverBlunderFen,
  hoverBlunderSan,
  panelMessage,
  pendingTravel,
  setAdviceArrow,
  setAdviceHoveredSquares,
} from "~/store/coachStore";
import { currentFen } from "~/store/gameStore";
import { isTravelling } from "~/store/travelStore";

// Regex to match standard algebraic notation (SAN) and raw squares
// Matches: e4, Nf3, Bxc6+, O-O, O-O-O, e8=Q
const CHESS_NOTATION_REGEX =
  /(\b[KQRBN]?[a-h]?[1-8]?x?[a-h][1-8](?:=[QRBN])?[+#]?\b|\bO-O(?:-O)?\b)/g;

export const CoachPanel: Component = () => {
  const { activateTravel, loading } = useTravelMode();

  const handleWhyTap = () => {
    if (loading()) return;
    const pending = pendingTravel();
    const fen = hoverBlunderFen() ?? pending?.blunderFen;
    const san = hoverBlunderSan() ?? pending?.blunderSan;
    const fenBefore = pending?.fenBefore;
    if (fen && san) activateTravel(fen, san, fenBefore);
  };

  let activeTapSan = "";

  const highlightSan = (text: string) => {
    const squares = text.match(/[a-h][1-8]/g) || [];
    setAdviceHoveredSquares(squares);

    // Resolve the SAN to from→to so ChessBoard can draw an arrow.
    try {
      const game = new Chess(currentFen());
      const match = game.moves({ verbose: true }).find((m) => m.san === text);
      if (match) {
        setAdviceArrow({ from: match.from, to: match.to });
      } else {
        setAdviceArrow(null);
      }
    } catch {
      setAdviceArrow(null);
    }
  };

  const clearHighlight = () => {
    setAdviceHoveredSquares([]);
    setAdviceArrow(null);
    activeTapSan = "";
  };

  const handleMouseEnter = (text: string) => highlightSan(text);
  const handleMouseLeave = () => clearHighlight();

  const handleTap = (text: string) => {
    if (activeTapSan === text) {
      clearHighlight();
    } else {
      activeTapSan = text;
      highlightSan(text);
    }
  };

  // Animation state for the whole panel (slide + bounce)
  const [isVisible, setIsVisible] = createSignal(false);
  const [animClass, setAnimClass] = createSignal<"enter" | "exit" | "">("");
  const [prevMessage, setPrevMessage] = createSignal("");

  createEffect(() => {
    const current = panelMessage().trim();
    const wasVisible = isVisible();
    const messageChanged = current !== prevMessage();

    if (current && (!wasVisible || messageChanged)) {
      // New message or message changed while visible → animate in
      setIsVisible(true);
      setAnimClass("enter");
      setPrevMessage(current);
    } else if (!current && wasVisible) {
      // Message cleared → animate out
      setAnimClass("exit");
      const timeout = setTimeout(() => {
        setIsVisible(false);
        setAnimClass("");
        setPrevMessage("");
      }, 300);
      onCleanup(() => clearTimeout(timeout));
    }
  });

  const parsedAdvice = () => advice().split(CHESS_NOTATION_REGEX);

  return (
    <Show when={isVisible()}>
      <div class={`${styles["coach-panel"]} ${styles[animClass()]}`}>
        <Show when={advice().trim().length > 0}>
          <p>
            <strong>Coach Selena:</strong>{" "}
            <For each={parsedAdvice()}>
              {(part) => {
                if (part.match(CHESS_NOTATION_REGEX)) {
                  return (
                    <span
                      class={styles["move-highlight"]}
                      onMouseEnter={() => handleMouseEnter(part)}
                      onMouseLeave={handleMouseLeave}
                      onClick={() => handleTap(part)}
                    >
                      {part}
                    </span>
                  );
                }
                return <span>{part}</span>;
              }}
            </For>
          </p>
        </Show>
        <Show when={(hoverBlunder() || pendingTravel()) && !isTravelling()}>
          <span class={styles["why-hint"]} onClick={handleWhyTap}>
            <span class={styles["why-desktop"]}>
              Press <kbd>Space</kbd> — To learn why
            </span>
            <span class={styles["why-mobile"]}>Tap here — To learn why</span>
          </span>
        </Show>
      </div>
    </Show>
  );
};
