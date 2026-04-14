import { useLocation } from "@solidjs/router";
import { Show, createEffect, onMount } from "solid-js";
import type { ParentComponent } from "solid-js";

import { LoadingOverlay } from "~/components/common/LoadingOverlay";
import { useGlobalShortcuts } from "~/hooks/useGlobalShortcuts";
import { fetchHello, postAdviceStream, postMove } from "~/services/api";
import { accumulateStream } from "~/services/streamUtils";
import {
  dispatchCoachEvent,
  isAppReady,
  setAdvice,
  setBestMovePhrases,
  setThinkingPhrases,
} from "~/store/coachStore";
import { addMoveSan, currentFen, fenHistory, game } from "~/store/gameStore";
import { activePlayerColor, difficulty } from "~/store/settingsStore";
import "~/theme.css";
import { initGlobalLogging, logger } from "~/utils/logger";

const ROUTE_STORAGE_KEY = "chess-coach:last-route";

const App: ParentComponent = (props) => {
  useGlobalShortcuts();

  const location = useLocation();
  createEffect(() => {
    const path = location.pathname;
    localStorage.setItem(ROUTE_STORAGE_KEY, path);
  });

  onMount(async () => {
    initGlobalLogging();
    logger.action("App Mounted");

    try {
      const helloData = await fetchHello();

      if (fenHistory().length > 1) {
        setAdvice("Welcome back! Let's continue our game.");
      } else {
        setAdvice(helloData.greeting);
      }

      setThinkingPhrases(helloData.thinking);
      setBestMovePhrases(helloData.bestMove);
      dispatchCoachEvent({ type: "APP_READY" });

      // Check if it's the AI's turn to move (only on the coach screen)
      if (window.location.pathname.endsWith("/selena")) {
        const g = game();
        const turn = currentFen().split(" ")[1];

        if (!g.isGameOver() && turn !== activePlayerColor()) {
          dispatchCoachEvent({ type: "AI_THINKING" });
          setAdvice("Let me think about my next move...");

          postMove({
            humanMoveSan: "",
            fenAfterHuman: currentFen(),
            difficulty: difficulty(),
          })
            .then(async (moveData) => {
              addMoveSan(moveData.move);
              dispatchCoachEvent({ type: "AI_MOVED" });

              await accumulateStream(
                postAdviceStream,
                { humanMove: "", aiMove: moveData.move, fen: moveData.fen },
                setAdvice,
              );
            })
            .catch((err) => {
              logger.error("Failed to execute AI continuation move", err);
              setAdvice("Error getting my move.");
              dispatchCoachEvent({ type: "AI_ERROR" });
            });
        }
      }
    } catch (err) {
      logger.error("Failed to fetch /hello", err);
      setAdvice("Hey! I couldn't connect to the server. Is it running?");
      dispatchCoachEvent({ type: "APP_ERROR" });
    }
  });

  return (
    <>
      <LoadingOverlay />
      <Show when={isAppReady()}>{props.children}</Show>
    </>
  );
};

export default App;
