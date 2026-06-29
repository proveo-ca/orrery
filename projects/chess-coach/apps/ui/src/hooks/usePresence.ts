// SPEC: _spec/chess-coach/ui/components.puml
import { createSignal, createEffect, onCleanup } from "solid-js";

export function usePresence(show: () => boolean, exitMs = 200) {
  const [present, setPresent] = createSignal(show());
  const [exiting, setExiting] = createSignal(false);
  let timer: ReturnType<typeof setTimeout> | undefined;

  createEffect(() => {
    if (show()) {
      if (timer) clearTimeout(timer);
      setExiting(false);
      setPresent(true);
    } else if (present()) {
      setExiting(true);
      timer = setTimeout(() => {
        setPresent(false);
        setExiting(false);
      }, exitMs);
    }
  });
  onCleanup(() => timer && clearTimeout(timer));

  return { present, exiting };
}
