import { createSignal, onCleanup } from "solid-js";

import styles from "~/components/common/Sparkle.module.css";

const STORAGE_KEY = "hasPressedHint";
const IDLE_MS = 10_000;

export function useHintSparkle() {
  const alreadyDismissed = localStorage.getItem(STORAGE_KEY) === "true";
  const [sparkle, setSparkle] = createSignal(false);

  if (!alreadyDismissed) {
    const timer = setTimeout(() => setSparkle(true), IDLE_MS);
    onCleanup(() => clearTimeout(timer));
  }

  const hintSparkleClass = () => (sparkle() ? styles.sparkle : undefined);

  const dismissHintSparkle = () => {
    setSparkle(false);
    localStorage.setItem(STORAGE_KEY, "true");
  };

  return { hintSparkleClass, dismissHintSparkle };
}
