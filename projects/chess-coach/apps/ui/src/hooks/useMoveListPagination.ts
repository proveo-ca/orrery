import { createEffect, createMemo, createSignal } from "solid-js";

import type { MoveRow } from "~/engine/moveAnnotations";
import { currentIndex } from "~/store/gameStore";

const ROWS_PER_PAGE = 8;

export function useMoveListPagination(rows: () => MoveRow[]) {
  const activePly = () => currentIndex() - 1;

  // Page derived from the active ply (auto-follow when navigating moves).
  const plyPage = createMemo(() => {
    const ply = activePly();
    if (ply < 0) return 0;
    const idx = rows().findIndex(
      (r) => r.whiteIndex === ply || r.blackIndex === ply,
    );
    return idx < 0 ? 0 : Math.floor(idx / ROWS_PER_PAGE);
  });

  // Manual override — null means follow plyPage.
  const [manualPage, setManualPage] = createSignal<number | null>(null);

  // Reset manual override when the active ply changes (user navigated moves).
  createEffect(() => {
    void plyPage();
    setManualPage(null);
  });

  const totalPages = createMemo(() =>
    Math.max(1, Math.ceil(rows().length / ROWS_PER_PAGE)),
  );

  const activePage = () => manualPage() ?? plyPage();

  const visibleRows = createMemo(() => {
    const start = activePage() * ROWS_PER_PAGE;
    return rows().slice(start, start + ROWS_PER_PAGE);
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
