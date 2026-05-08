// SPEC: _spec/chess-coach/ui/components.puml
import { A } from "@solidjs/router";
import { createMemo, createSignal, For, Show } from "solid-js";
import type { Component } from "solid-js";
import { GameHistoryFilters } from "./GameHistoryFilters";

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
  // Filters
  const [colorFilter, setColorFilter] = createSignal<"w" | "b">("w");
  const [firstMoveFilter, setFirstMoveFilter] = createSignal<string | null>(null);

  const filteredGames = createMemo(() => {
    const color = colorFilter();
    const fm = firstMoveFilter();
    return gameHistory().filter((g) => {
      if (g.playerColor !== color) return false;
      if (fm && g.moves[0]?.san !== fm) return false;
      return true;
    });
  });

  // Date grouping (newest first)
  const dateGroups = createMemo(() => {
    const groups = new Map<string, GameRecord[]>();
    for (const g of filteredGames()) {
      const d = g.startedAt.slice(0, 10); // yyyy-mm-dd
      if (!groups.has(d)) groups.set(d, []);
      groups.get(d)!.push(g);
    }
    return Array.from(groups.entries())
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .map(([dateKey, games]) => ({ dateKey, games }));
  });

  // Pagination over dates
  const totalPages = createMemo(() => Math.max(1, dateGroups().length));
  const [manualPage, setManualPage] = createSignal<number | null>(null);
  const activePage = () => manualPage() ?? 0;
  const visibleGames = createMemo(() => {
    const idx = Math.min(activePage(), totalPages() - 1);
    const group = dateGroups()[idx];
    return group ? group.games : [];
  });
  const currentDateLabel = createMemo(() => {
    const idx = Math.min(activePage(), totalPages() - 1);
    const group = dateGroups()[idx];
    if (!group) return "";
    try {
      const d = new Date(group.dateKey);
      return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
    } catch {
      return group.dateKey;
    }
  });

  const clamp = (p: number) => Math.max(0, Math.min(p, totalPages() - 1));
  const goToPrev = () => setManualPage(clamp(activePage() - 1));
  const goToNext = () => setManualPage(clamp(activePage() + 1));

  // Available first moves for filter buttons (from current filtered set)
  const availableFirstMoves = createMemo(() => {
    const set = new Set<string>();
    for (const g of filteredGames()) {
      if (g.moves[0]?.san) set.add(g.moves[0].san);
    }
    return Array.from(set).sort();
  });

  return (
    <div class={styles.wrapper} role="list" aria-label="Recent games">
      <Show
        when={gameHistory().length > 0}
        fallback={<div class={styles.empty}>No games yet. Play one to see it here.</div>}
      >
        <GameHistoryFilters
          colorFilter={colorFilter()}
          setColorFilter={(v) => {
            setColorFilter(v);
            setFirstMoveFilter(null);
            setManualPage(null);
          }}
          firstMoveFilter={firstMoveFilter()}
          setFirstMoveFilter={(san) => {
            setFirstMoveFilter(san);
            setManualPage(null);
          }}
          availableFirstMoves={availableFirstMoves()}
          totalPages={totalPages()}
          activePage={activePage()}
          currentDateLabel={currentDateLabel()}
          goToPrev={goToPrev}
          goToNext={goToNext}
        />
      </Show>

      <Show
        when={filteredGames().length > 0}
        fallback={<div class={styles.empty}>No games match the filters.</div>}
      >
        <For each={visibleGames()}>
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
