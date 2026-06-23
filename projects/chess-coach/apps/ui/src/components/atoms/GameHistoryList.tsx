import type { GameRecord } from "~/types/game";
import { A } from "@solidjs/router";
import { For, Show } from "solid-js";
import type { Component } from "solid-js";

import styles from "~/components/atoms/GameHistoryList.module.css";
import { ShareIcon } from "~/components/primitives/icons";
import { useShareGame } from "~/hooks/useShareGame";
import { formatGameLabel } from "~/utils/gameTitle";

interface Props {
  games: GameRecord[];
  activeId?: string;
}

const movePreview = (g: GameRecord): string => {
  const tokens = g.moves
    .slice(0, 4)
    .map((m) => m.san)
    .filter(Boolean);
  if (tokens.length === 0) return "(no moves)";
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
  const { share, shareMsg } = useShareGame();
  return (
    <div class={styles.wrapper} role="list" aria-label="Recent games">
      <Show
        when={props.games.length > 0}
        fallback={<div class={styles.empty}>No games match the filters.</div>}
      >
        <For each={props.games}>
          {(g) => (
            <div class={styles.item} role="listitem">
              <A
                href={`/review/${g.id}`}
                class={styles.tile}
                classList={{ [styles["tile--active"]]: props.activeId === g.id }}
                data-game-id={g.id}
              >
                <div class={styles.header}>
                  <span class={`${styles.result} ${resultClass(g.result)}`}>{g.result}</span>
                  <span class={styles.date}>{formatDate(g.startedAt)}</span>
                </div>
                <div class={styles.preview}>{formatGameLabel(g)}</div>
                <div class={styles.preview}>{movePreview(g)}</div>
              </A>
              <button
                type="button"
                class={styles.share}
                title="Share game"
                aria-label={`Share game: ${formatGameLabel(g)}`}
                onClick={() => void share(g)}
              >
                <ShareIcon size={16} />
              </button>
            </div>
          )}
        </For>
      </Show>
      <Show when={shareMsg()}>
        <div class={styles.shareMsg} role="status">
          {shareMsg()}
        </div>
      </Show>
    </div>
  );
};
