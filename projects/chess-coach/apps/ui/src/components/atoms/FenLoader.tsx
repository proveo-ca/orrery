import { Show, createSignal } from "solid-js";
import type { Component } from "solid-js";

import styles from "~/components/atoms/FenLoader.module.css";
import { Button } from "~/components/primitives/Button";
import { loadFen } from "~/store/gameStore";

const FEN_REGEX =
  /^([rnbqkpRNBQKP1-8]+\/){7}[rnbqkpRNBQKP1-8]+ [wb] (-|[KQkq]+) (-|[a-h][36]) \d+ \d+$/;

export const FenLoader: Component = () => {
  const [value, setValue] = createSignal("");
  const [error, setError] = createSignal<string | null>(null);

  const submit = () => {
    const fen = value().trim();
    if (!fen) {
      setError("Please enter a FEN string.");
      return;
    }
    if (!FEN_REGEX.test(fen)) {
      setError("Invalid FEN format.");
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
      <form class={`${styles.wrapper} mobile-nav-clear`}>
        <textarea
          name="fen"
          rows={3}
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
      </form>
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
