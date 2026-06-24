import { createEffect, createMemo, createSignal } from "solid-js";

import { currentIndex } from "~/store/gameStore";
import type { MoveRow } from "~/types/analysis";

const DEFAULT_ROWS_PER_PAGE = 8;

export function useMoveListPagination(
  rows: () => MoveRow[],
  options?: { rowsPerPage?: number | (() => number); activePly?: () => number | null | undefined },
) {
  const getRowsPerPage = () => {
    const rpp = options?.rowsPerPage;
    if (typeof rpp === "function") return rpp();
    if (typeof rpp === "number") return rpp;
    return DEFAULT_ROWS_PER_PAGE;
  };

  const activePly = () => {
    const override = options?.activePly?.();
    if (override != null) return override;

    const ply = currentIndex() - 1;
    return ply;
  };

  // Page derived from the active ply (auto-follow when navigating moves).
  const plyPage = createMemo(() => {
    const ply = activePly();
    if (ply < 0) return 0;
    const idx = rows().findIndex((r) => r.whiteIndex === ply || r.blackIndex === ply);
    return idx < 0 ? 0 : Math.floor(idx / getRowsPerPage());
  });

  // Manual override — null means follow plyPage.
  const [manualPage, setManualPage] = createSignal<number | null>(null);

  // Reset manual override when the active ply changes (user navigated moves).
  createEffect(() => {
    void plyPage();
    setManualPage(null);
  });

  const totalPages = createMemo(() => Math.max(1, Math.ceil(rows().length / getRowsPerPage())));

  const activePage = () => manualPage() ?? plyPage();

  const visibleRows = createMemo(() => {
    const start = activePage() * getRowsPerPage();
    return rows().slice(start, start + getRowsPerPage());
  });

  const clamp = (p: number) => Math.max(0, Math.min(p, totalPages() - 1));

  const goToStart = () => setManualPage(0);
  const goToEnd = () => setManualPage(totalPages() - 1);
  const goToPrev = () => setManualPage(clamp(activePage() - 1));
  const goToNext = () => setManualPage(clamp(activePage() + 1));

  return {
    activePly,
    activePage,
    totalPages,
    visibleRows,
    goToStart,
    goToEnd,
    goToPrev,
    goToNext,
  };
}
