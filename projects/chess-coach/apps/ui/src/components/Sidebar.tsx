import { Chess } from "chess.js";
import { Show, createSignal } from "solid-js";
import type { Component } from "solid-js";

import { Credits } from "~/components/Credits";
import { DualNavButton } from "~/components/DualNavButton";
import { CheckIcon, HintIcon, PlusCircleIcon, StarIcon } from "~/components/icons";
import { NewGamePanel } from "~/components/NewGamePanel";
import { Modal } from "~/components/common/Modal";
import styles from "~/components/Sidebar.module.css";
import { DEFAULT_STOCKFISH_WORKER_URL } from "~/engine/StockfishEngine.ts";
import { useHint } from "~/hooks/useHint";
import { postExplainStream } from "~/services/api";
import { clearHoverOverride, dispatchCoachEvent, setAdvice } from "~/store/coachStore";
import { currentFen, currentIndex, fenHistory, goBack, goForward } from "~/store/gameStore";
import {
  exitTravel,
  isTravelling,
  travelBack,
  travelFenHistory,
  travelForward,
  travelIndex,
} from "~/store/travelStore";

export const Sidebar: Component = () => {
  const [showCredits, setShowCredits] = createSignal(false);
  const [showNewGame, setShowNewGame] = createSignal(false);
  const { requestHint, pendingHint } = useHint(DEFAULT_STOCKFISH_WORKER_URL);

  const atStart = () => (isTravelling() ? travelIndex() === 0 : currentIndex() === 0);
  const atLatest = () =>
    isTravelling()
      ? travelIndex() === travelFenHistory().length - 1
      : currentIndex() === fenHistory().length - 1;

  const isReplaying = () => currentIndex() < fenHistory().length - 1;

  const handleBack = () => {
    if (isTravelling()) {
      if (travelIndex() === 0) {
        exitTravel();
        clearHoverOverride();
      } else {
        travelBack();
      }
    } else {
      goBack();
    }
  };

  const handleForward = () => {
    if (isTravelling()) {
      travelForward();
    } else {
      goForward();
    }
  };

  const handleBackToLive = () => {
    if (isTravelling()) {
      exitTravel();
    }
    while (currentIndex() < fenHistory().length - 1) {
      goForward();
    }
    clearHoverOverride();
  };

  const handleHint = async () => {
    try {
      dispatchCoachEvent({ type: "AI_THINKING" });
      const uciMove = await requestHint(currentFen(), 10);

      if (!uciMove) {
        setAdvice("I'm not sure what the best move is here.");
        dispatchCoachEvent({ type: "AI_MOVED" });
        return;
      }

      const game = new Chess(currentFen());
      const from = uciMove.slice(0, 2);
      const to = uciMove.slice(2, 4);
      const promotion = uciMove.length > 4 ? uciMove[4] : undefined;

      const moveObj = game.move({ from, to, promotion });
      if (!moveObj) {
        setAdvice(`Try moving ${from}-${to}.`);
        dispatchCoachEvent({ type: "AI_MOVED" });
        return;
      }

      const san = moveObj.san;
      const fenAfter = game.fen();
      const prefix = `Try moving ${san}. `;

      setAdvice(`${prefix}Let me explain why...`);

      let fullExplanation = "";
      let receivedFirstChunk = false;

      await postExplainStream(
        { fenBefore: currentFen(), fenAfter, isBlunder: false, moveSan: san },
        (chunk) => {
          if (!receivedFirstChunk) {
            fullExplanation = "";
            receivedFirstChunk = true;
          }
          fullExplanation += chunk;
          setAdvice(prefix + fullExplanation);
        },
      );

      dispatchCoachEvent({ type: "AI_MOVED" });
    } catch (err) {
      console.error(err);
      setAdvice("Unable to generate a hint right now.");
      dispatchCoachEvent({ type: "AI_ERROR" });
    }
  };

  return (
    <div class={styles.sidebar}>
      <DualNavButton
        onBack={handleBack}
        onForward={handleForward}
        backDisabled={atStart() && !isTravelling()}
        forwardDisabled={atLatest()}
        inverted={isTravelling() || isReplaying()}
      />

      <Show when={isTravelling() || isReplaying()}>
        <div class={styles["travel-section"]}>
          <Show when={isTravelling()}>
            <span class={styles["move-counter"]}>
              {travelIndex()}/{travelFenHistory().length - 1}
            </span>
          </Show>
          <button
            class={styles["icon-btn"]}
            onClick={handleBackToLive}
            aria-label="Back to live"
          >
            <CheckIcon />
          </button>
        </div>
      </Show>

      <div class={styles.divider} />

      <button
        class={styles["icon-btn"]}
        onClick={handleHint}
        disabled={pendingHint() || isReplaying() || isTravelling()}
        aria-label="Get a hint"
      >
        <HintIcon />
      </button>

      <button
        class={styles["icon-btn"]}
        onClick={() => setShowNewGame(true)}
        aria-label="New game"
      >
        <PlusCircleIcon />
      </button>

      <button
        class={styles["icon-btn"]}
        onClick={() => setShowCredits(true)}
        disabled={isReplaying() || isTravelling()}
        aria-label="Credits"
      >
        <StarIcon />
      </button>

      <Modal
        open={showNewGame()}
        onClose={() => setShowNewGame(false)}
        title="New Game"
        position="fixed"
      >
        <NewGamePanel />
      </Modal>

      <Credits open={showCredits()} onClose={() => setShowCredits(false)} />
    </div>
  );
};
