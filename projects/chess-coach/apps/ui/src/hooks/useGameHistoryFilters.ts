import { useSearchParams } from "@solidjs/router";
import { createMemo, createSignal } from "solid-js";

import { gameHistory } from "~/store/gameHistoryStore";
import type { GameRecord } from "~/types/game";

export function useGameHistoryFilters() {
  const [searchParams, setSearchParams] = useSearchParams();

  // Normalize query param values (they can be string | string[])
  const getParam = (key: string): string | null => {
    const val = searchParams[key];
    if (!val) return null;
    return Array.isArray(val) ? val[0] : val;
  };

  // Initialize from URL query params with explicit defaults
  const initialColor = (getParam("color") === "b" ? "b" : "w") as "w" | "b";
  const initialFirstMove = getParam("firstMove");
  const initialPage = getParam("page") ? parseInt(getParam("page")!, 10) - 1 : 0;

  const [colorFilter, setColorFilter] = createSignal<"w" | "b">(initialColor);
  const [firstMoveFilter, setFirstMoveFilter] = createSignal<string | null>(initialFirstMove);
  const [manualPage, setManualPage] = createSignal<number>(initialPage);

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
  const activePage = createMemo(() => {
    const p = manualPage();
    return Math.min(p, totalPages() - 1);
  });

  const visibleGames = createMemo(() => {
    const idx = activePage();
    const group = dateGroups()[idx];
    return group ? group.games : [];
  });

  const currentDateLabel = createMemo(() => {
    const idx = activePage();
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

  const updateSearchParams = (updates: Record<string, string | null | undefined>) => {
    setSearchParams(updates, { replace: true });
  };

  const setColorFilterWithUrl = (v: "w" | "b") => {
    setColorFilter(v);
    setFirstMoveFilter(null);
    setManualPage(0); // reset to page 1
    updateSearchParams({ color: v, firstMove: null, page: "1" });
  };

  const setFirstMoveFilterWithUrl = (san: string | null) => {
    setFirstMoveFilter(san);
    setManualPage(0); // reset to page 1
    updateSearchParams({ firstMove: san, page: "1" });
  };

  const setManualPageWithUrl = (page: number) => {
    const clamped = clamp(page);
    setManualPage(clamped);
    updateSearchParams({ page: String(clamped + 1) });
  };

  const goToPrev = () => {
    setManualPageWithUrl(activePage() - 1);
  };

  const goToNext = () => {
    setManualPageWithUrl(activePage() + 1);
  };

  return {
    colorFilter,
    setColorFilter: setColorFilterWithUrl,
    firstMoveFilter,
    setFirstMoveFilter: setFirstMoveFilterWithUrl,
    filteredGames,
    totalPages,
    activePage,
    visibleGames,
    currentDateLabel,
    goToPrev,
    goToNext,
    availableFirstMoves,
    setManualPage: setManualPageWithUrl,
  };
}
