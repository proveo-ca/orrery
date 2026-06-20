// SPEC: _spec/chess-coach/ui/components.puml
import { createSignal, onCleanup } from "solid-js";

const STORAGE_KEY = "hasPressedHint";
const IDLE_MS = 10_000;

export function useHintSparkle() {
  const alreadyDismissed = localStorage.getItem(STORAGE_KEY) === "true";
  const [sparkle, setSparkle] = createSignal(false);

  if (!alreadyDismissed) {
    const timer = setTimeout(() => setSparkle(true), IDLE_MS);
    onCleanup(() => clearTimeout(timer));
  }

  const hintSparkleClass = () => (sparkle() ? "sparkle" : undefined);

  const dismissHintSparkle = () => {
    setSparkle(false);
    localStorage.setItem(STORAGE_KEY, "true");
  };

  return { hintSparkleClass, dismissHintSparkle };
}
