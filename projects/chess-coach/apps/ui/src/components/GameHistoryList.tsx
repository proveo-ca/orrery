// SPEC: _spec/chess-coach/ui/components.puml
import { A } from "@solidjs/router";
import { For, Show } from "solid-js";
import type { Component } from "solid-js";

import styles from "~/components/GameHistoryList.module.css";
import { type GameRecord, gameHistory } from "~/store/gameHistoryStore";

interface Props {
  activeId?: string;
}

/** Best-effort preview: first ~4 SAN tokens from the PGN. */
const movePreview = (g: GameRecord): string => {
  const tokens = g.moves
    .slice(0, 4)
    .map((m) => m.san)
    .filter(Boolean);
  if (tokens.length === 0) return "(no moves)";
  // Group into "1. e4 e5 2. Nf3"
  const parts: string[] = [];
  for (let i = 0; i < tokens.length; i += 2) {
    const num = Math.floor(i / 2) + 1;
    parts.push(`${num}. ${tokens[i]}${tokens[i + 1] ? ` ${tokens[i + 1]}` : ""}`);
  }
  return parts.join(" ");
};

const formatDate = (iso: string): string => {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return "";
  }
};

const resultClass = (r: GameRecord["result"]): string => {
  switch (r) {
    case "win":
      return styles["result--win"];
    case "loss":
      return styles["result--loss"];
    case "draw":
      return styles["result--draw"];
    default:
      return styles["result--ongoing"];
  }
};

export const GameHistoryList: Component<Props> = (props) => {
  return (
    <div class={styles.wrapper} role="list" aria-label="Recent games">
      <Show
        when={gameHistory().length > 0}
        fallback={<div class={styles.empty}>No games yet. Play one to see it here.</div>}
      >
        <For each={gameHistory()}>
          {(g) => (
            <A
              role="listitem"
              href={`/review/${g.id}`}
              class={styles.tile}
              classList={{ [styles["tile--active"]]: props.activeId === g.id }}
              data-game-id={g.id}
            >
              <div class={styles.header}>
                <span class={`${styles.result} ${resultClass(g.result)}`}>{g.result}</span>
                <span class={styles.date}>{formatDate(g.startedAt)}</span>
              </div>
              <div class={styles.preview}>{movePreview(g)}</div>
            </A>
          )}
        </For>
      </Show>
    </div>
  );
};
