import { Chess } from "chess.js";
import clsx from "clsx";
import { Show, createSignal } from "solid-js";
import type { Component } from "solid-js";

import { useNavigate } from "@solidjs/router";

import { Credits } from "~/components/Credits";
import { DualNavButton } from "~/components/DualNavButton";
import {
  CheckIcon,
  HamburgerIcon,
  HintIcon,
  PlusCircleIcon,
  StarIcon,
} from "~/components/icons";
import styles from "~/components/MobileDrawer.module.css";
import { NewGamePanel } from "~/components/NewGamePanel";
import { Modal } from "~/components/common/Modal";
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

export const MobileDrawer: Component = () => {
  const navigate = useNavigate();
  const [open, setOpen] = createSignal(false);
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
    setOpen(false);
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
    <div class={styles["mobile-only"]}>
      <button
        class={styles["hamburger-btn"]}
        onClick={() => setOpen(true)}
        aria-label="Open menu"
      >
        <HamburgerIcon />
      </button>

      <div class={styles["top-right-nav"]}>
        <DualNavButton
          onBack={handleBack}
          onForward={handleForward}
          backDisabled={atStart() && !isTravelling()}
          forwardDisabled={atLatest()}
          inverted={isTravelling() || isReplaying()}
        />

        <Show when={isTravelling()}>
          <span class={styles["travel-info"]}>
            {travelIndex()}/{travelFenHistory().length - 1}
          </span>
        </Show>

        <Show when={isTravelling() || isReplaying()}>
          <button
            class={styles["icon-btn"]}
            onClick={handleBackToLive}
            aria-label="Back to live"
          >
            <CheckIcon />
          </button>
        </Show>
      </div>

      <div
        class={clsx(styles.backdrop, open() && styles["backdrop--open"])}
        onClick={() => setOpen(false)}
      />

      <div class={clsx(styles.drawer, open() && styles["drawer--open"])}>
        <p class={styles["section-title"]}>Menu</p>
        <div class={styles["menu-list"]}>
          <button class={styles["menu-btn"]} onClick={() => { setOpen(false); navigate("/selena"); }}>
            Play with Selena
          </button>
          <button class={styles["menu-btn"]} onClick={() => { setOpen(false); navigate("/analysis"); }}>
            Solo Analysis
          </button>
          <button class={styles["menu-btn"]} disabled>
            Play LAN
          </button>
          <span class={styles["coming-soon"]}>Coming soon!</span>
        </div>

        <div class={styles.divider} />

        <p class={styles["section-title"]}>Controls</p>
        <div class={styles["controls-row"]}>
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
            onClick={() => {
              setOpen(false);
              setShowNewGame(true);
            }}
            aria-label="New game"
          >
            <PlusCircleIcon />
          </button>

          <button
            class={styles["icon-btn"]}
            onClick={() => {
              setOpen(false);
              setShowCredits(true);
            }}
            disabled={isReplaying() || isTravelling()}
            aria-label="Credits"
          >
            <StarIcon />
          </button>
        </div>
      </div>

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
