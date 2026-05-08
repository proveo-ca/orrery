import { useLocation } from "@solidjs/router";
import { Show, createEffect, onMount } from "solid-js";
import type { ParentComponent } from "solid-js";

import { LoadingOverlay } from "~/components/common/LoadingOverlay";
import { useGlobalShortcuts } from "~/hooks/useGlobalShortcuts";
import { dispatchCoachEvent, isAppReady } from "~/store/coachStore";
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

  onMount(() => {
    initGlobalLogging();
    logger.action("App Mounted");
    dispatchCoachEvent({ type: "APP_READY" });
  });

  return (
    <>
      <LoadingOverlay />
      <Show when={isAppReady()}>{props.children}</Show>
    </>
  );
};

export default App;
