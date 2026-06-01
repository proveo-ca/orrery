// SPEC: _spec/chess-coach/ui/components.puml
import { For, Show, createSignal, onCleanup, onMount } from "solid-js";
import type { Component } from "solid-js";

import { CoachEmotionIcon } from "~/components/CoachEmotionIcon";
import { ChevronLeftIcon, ChevronRightIcon, HintIcon } from "~/components/common/icons";
import styles from "~/components/MoveList.module.css";
import {
  type AnnotationTag,
  formatCp,
  pairMovesIntoRows,
  resolveAnnotations,
} from "~/engine/moveAnnotations";
import { useGameAnalysis, type GameAnalysis } from "~/hooks/useGameAnalysis";
import { useMoveListPagination } from "~/hooks/useMoveListPagination";
import type { GameRecord, MoveRecord } from "~/store/gameHistoryStore";
import { setViewIndex } from "~/store/gameStore";

// ── Presentational sub-components ──────────────────────────────────────

const TagIcon: Component<{ tag: AnnotationTag }> = (props) => {
  switch (props.tag) {
    case "best":
      return (
        <span class={`${styles.tag} ${styles["tag--best"]}`} title="Best move">
          <CoachEmotionIcon emotion="happy" title="best move" />
        </span>
      );
    case "blunder":
      return (
        <span class={`${styles.tag} ${styles["tag--blunder"]}`} title="Blunder">
          <CoachEmotionIcon emotion="shocked" title="blunder" />
        </span>
      );
    case "forced":
      return (
        <span class={`${styles.tag} ${styles["tag--forced"]}`} title="Forced — no better option">
          <CoachEmotionIcon emotion="shocked" title="forced" />
        </span>
      );
    case "inaccuracy":
      return (
        <span class={`${styles.tag} ${styles["tag--inaccuracy"]}`} title="Inaccuracy">
          <CoachEmotionIcon emotion="thinking" title="inaccuracy" />
        </span>
      );
    case "hint":
      return (
        <span class={`${styles.tag} ${styles["tag--hint"]}`} title="Hint used">
          <HintIcon size={16} />
        </span>
      );
  }
};

const cpColorClass = (cp: number): string => {
  if (cp > 0) return styles["cp--positive"];
  if (cp < 0) return styles["cp--negative"];
  return styles["cp--neutral"];
};

const PlyCell: Component<{
  move: MoveRecord;
  index: number;
  cpDelta: number | null;
  tags: AnnotationTag[];
  active: boolean;
  onJump: () => void;
  showCp?: boolean;
}> = (props) => (
  <button
    type="button"
    class={styles.ply}
    classList={{ [styles["ply--active"]]: props.active }}
    onClick={props.onJump}
    data-ply={props.index}
  >
    <span class={styles.san}>{props.move.san}</span>
    {props.showCp && props.cpDelta != null && (
      <span class={`${styles.cp} ${cpColorClass(props.cpDelta)}`}>{formatCp(props.cpDelta)}</span>
    )}
    <span class={styles.tags}>
      <For each={props.tags}>{(tag) => <TagIcon tag={tag} />}</For>
    </span>
  </button>
);

// ── Container component ────────────────────────────────────────────────

interface Props {
  game: GameRecord | null;
  activePly?: number | null;
  analysis?: GameAnalysis;
}

export const MoveList: Component<Props> = (props) => {
  const internalAnalysis = useGameAnalysis(() => props.game);
  const analysisSignal = () => props.analysis ?? internalAnalysis();
  const annotations = () => {
    const g = props.game;
    if (!g) return [];
    const a = analysisSignal();
    return resolveAnnotations(g.moves, a.cpDeltas, a.wasBestMoves, a.bestMoveUcis);
  };
  const rows = () =>
    props.game ? pairMovesIntoRows(props.game.moves, props.game.startingFen) : [];

  // Responsive rows per page: 3 on desktop/landscape, 8 on mobile
  const [isLandscape, setIsLandscape] = createSignal(false);

  onMount(() => {
    const media = window.matchMedia("(min-width: 768px)");
    const update = () => setIsLandscape(media.matches);
    update();
    media.addEventListener("change", update);
    onCleanup(() => media.removeEventListener("change", update));
  });

  const rowsPerPage = () => (isLandscape() ? 3 : 8);

  const { activePly, activePage, totalPages, visibleRows, goToStart, goToEnd, goToPrev, goToNext } =
    useMoveListPagination(rows, { rowsPerPage, activePly: () => props.activePly });

  const jump = (plyIndex: number) => {
    if (plyIndex < 0) return;
    setViewIndex(plyIndex + 1);
  };

  // Swipe left/right for page navigation on mobile.
  let wrapperRef: HTMLDivElement | undefined;
  let touchStartX = 0;

  const onTouchStart = (e: TouchEvent) => {
    touchStartX = e.touches[0].clientX;
  };
  const onTouchEnd = (e: TouchEvent) => {
    const dx = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(dx) > 50) {
      if (dx < 0) goToNext();
      else goToPrev();
    }
  };

  onMount(() => {
    wrapperRef?.addEventListener("touchstart", onTouchStart, { passive: true });
    wrapperRef?.addEventListener("touchend", onTouchEnd, { passive: true });
  });
  onCleanup(() => {
    wrapperRef?.removeEventListener("touchstart", onTouchStart);
    wrapperRef?.removeEventListener("touchend", onTouchEnd);
  });

  return (
    <div ref={wrapperRef} class={`${styles.wrapper} mobile-nav-clear`} aria-label="Move list">
      <Show
        when={props.game && props.game.moves.length > 0}
        fallback={<div class={styles.empty}>No moves recorded.</div>}
      >
        <Show when={totalPages() > 1}>
          <div class={styles["page-nav"]}>
            <button
              class={styles["page-btn"]}
              onClick={goToStart}
              disabled={activePage() === 0}
              aria-label="First page"
            >
              <ChevronLeftIcon size={14} />
              <ChevronLeftIcon size={14} />
            </button>
            <button
              class={styles["page-btn"]}
              onClick={goToPrev}
              disabled={activePage() === 0}
              aria-label="Previous page"
            >
              <ChevronLeftIcon size={14} />
            </button>
            <span class={styles["page-indicator"]}>
              {activePage() + 1} / {totalPages()}
            </span>
            <button
              class={styles["page-btn"]}
              onClick={goToNext}
              disabled={activePage() >= totalPages() - 1}
              aria-label="Next page"
            >
              <ChevronRightIcon size={14} />
            </button>
            <button
              class={styles["page-btn"]}
              onClick={goToEnd}
              disabled={activePage() >= totalPages() - 1}
              aria-label="Last page"
            >
              <ChevronRightIcon size={14} />
              <ChevronRightIcon size={14} />
            </button>
          </div>
        </Show>
        <For each={visibleRows()}>
          {(row) => (
            <div class={styles.row}>
              <span class={styles.turn}>{row.turn}.</span>
              {row.white ? (
                <PlyCell
                  move={row.white}
                  index={row.whiteIndex}
                  cpDelta={analysisSignal().cpDeltas[row.whiteIndex] ?? null}
                  tags={annotations()[row.whiteIndex] ?? []}
                  active={activePly() === row.whiteIndex}
                  onJump={() => jump(row.whiteIndex)}
                  showCp={props.game?.playerColor === "w"}
                />
              ) : (
                <span />
              )}
              {row.black ? (
                <PlyCell
                  move={row.black}
                  index={row.blackIndex}
                  cpDelta={analysisSignal().cpDeltas[row.blackIndex] ?? null}
                  tags={annotations()[row.blackIndex] ?? []}
                  active={activePly() === row.blackIndex}
                  onJump={() => jump(row.blackIndex)}
                  showCp={props.game?.playerColor === "b"}
                />
              ) : (
                <span />
              )}
            </div>
          )}
        </For>
      </Show>
    </div>
  );
};
