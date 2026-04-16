import { Show, createSignal } from "solid-js";
import type { Component } from "solid-js";

import { Button } from "~/components/common/Button";
import styles from "~/components/FenLoader.module.css";
import { loadFen } from "~/store/gameStore";

export const FenLoader: Component = () => {
  const [value, setValue] = createSignal("");
  const [error, setError] = createSignal<string | null>(null);

  const submit = () => {
    const fen = value().trim();
    if (!fen) {
      setError("Please enter a FEN string.");
      return;
    }
    try {
      loadFen(fen);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invalid FEN.");
    }
  };

  return (
    <>
      <div class={`${styles.wrapper} mobile-nav-clear`}>
        <input
          type="text"
          class={styles.input}
          classList={{ [styles["input--invalid"]]: !!error() }}
          placeholder="Load from FEN"
          aria-label="Load from FEN"
          value={value()}
          onInput={(e) => setValue(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
        />
        <Button type="button" class={styles.button} onClick={submit}>
          Load
        </Button>
      </div>
      <Show when={error()}>
        {(msg) => (
          <div class={styles.error} role="alert">
            {msg()}
          </div>
        )}
      </Show>
    </>
  );
};
