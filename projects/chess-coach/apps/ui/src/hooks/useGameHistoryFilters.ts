import { createMemo, createSignal } from "solid-js";

import { type GameRecord, gameHistory } from "~/store/gameHistoryStore";

export function useGameHistoryFilters() {
  const [colorFilter, setColorFilter] = createSignal<"w" | "b">("w");
  const [firstMoveFilter, setFirstMoveFilter] = createSignal<string | null>(null);
  const [manualPage, setManualPage] = createSignal<number | null>(null);

  const filteredGames = createMemo(() => {
    const color = colorFilter();
    const fm = firstMoveFilter();
    const moveIndex = color === "w" ? 0 : 1;

    return gameHistory().filter((g) => {
      if (g.playerColor !== color) return false;
      if (fm) {
        const playerFirstMove = g.moves[moveIndex]?.san;
        if (playerFirstMove !== fm) return false;
      }
      return true;
    });
  });

  // Available first moves should only depend on color, not the first-move filter
  const availableFirstMoves = createMemo(() => {
    const color = colorFilter();
    const moveIndex = color === "w" ? 0 : 1;
    const set = new Set<string>();
    for (const g of gameHistory()) {
      if (g.playerColor === color && g.moves[moveIndex]?.san) {
        set.add(g.moves[moveIndex].san);
      }
    }
    return Array.from(set).sort();
  });

  const dateGroups = createMemo(() => {
    const groups = new Map<string, GameRecord[]>();
    for (const g of filteredGames()) {
      const d = g.startedAt.slice(0, 10);
      if (!groups.has(d)) groups.set(d, []);
      groups.get(d)!.push(g);
    }
    return Array.from(groups.entries())
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .map(([dateKey, games]) => ({ dateKey, games }));
  });

  const totalPages = createMemo(() => Math.max(1, dateGroups().length));
  const activePage = createMemo(() => manualPage() ?? 0);

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

  return {
    colorFilter,
    setColorFilter: (v: "w" | "b") => {
      setColorFilter(v);
      setFirstMoveFilter(null);
      setManualPage(null);
    },
    firstMoveFilter,
    setFirstMoveFilter: (san: string | null) => {
      setFirstMoveFilter(san);
      setManualPage(null);
    },
    filteredGames,
    totalPages,
    activePage,
    visibleGames,
    currentDateLabel,
    goToPrev,
    goToNext,
    availableFirstMoves,
  };
}
