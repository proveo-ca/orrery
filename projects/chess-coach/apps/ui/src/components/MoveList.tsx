import { For, Show } from "solid-js";
import type { Component } from "solid-js";

import { CoachEmotionIcon } from "~/components/CoachEmotionIcon";
import { HintIcon } from "~/components/common/icons";
import styles from "~/components/MoveList.module.css";
import {
  type AnnotationTag,
  formatCp,
  pairMovesIntoRows,
  resolveAnnotations,
} from "~/engine/moveAnnotations";
import { useBlunderArrow } from "~/hooks/useBlunderArrow";
import { useGameAnalysis } from "~/hooks/useGameAnalysis";
import type { GameRecord, MoveRecord } from "~/store/gameHistoryStore";
import { currentIndex, setViewIndex } from "~/store/gameStore";

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
}> = (props) => (
  <button
    type="button"
    class={styles.ply}
    classList={{ [styles["ply--active"]]: props.active }}
    onClick={props.onJump}
    data-ply={props.index}
  >
    <span class={styles.san}>{props.move.san}</span>
    {!props.move.isAI && props.cpDelta != null && (
      <span class={`${styles.cp} ${cpColorClass(props.cpDelta)}`}>
        {formatCp(props.cpDelta)}
      </span>
    )}
    {!props.move.isAI && props.move.hasPressedHint && (
      <span class={styles["hint-badge"]} title="Hint used">
        <HintIcon size={14} />
      </span>
    )}
    <span class={styles.tags}>
      <For each={props.tags}>{(tag) => <TagIcon tag={tag} />}</For>
    </span>
  </button>
);

// ── Container component ────────────────────────────────────────────────

interface Props {
  game: GameRecord | null;
}

export const MoveList: Component<Props> = (props) => {
  const gameAnalysis = useGameAnalysis(() => props.game);
  const annotations = () => {
    const g = props.game;
    if (!g) return [];
    const a = gameAnalysis();
    return resolveAnnotations(g.moves, a.cpDeltas, a.wasBestMoves);
  };
  const rows = () => (props.game ? pairMovesIntoRows(props.game.moves, props.game.startingFen) : []);
  const activePly = () => currentIndex() - 1;

  useBlunderArrow(annotations);

  const jump = (plyIndex: number) => {
    if (plyIndex < 0) return;
    setViewIndex(plyIndex + 1);
  };

  return (
    <div class={styles.wrapper} aria-label="Move list">
      <Show
        when={props.game && props.game.moves.length > 0}
        fallback={<div class={styles.empty}>No moves recorded.</div>}
      >
        <For each={rows()}>
          {(row) => (
            <div class={styles.row}>
              <span class={styles.turn}>{row.turn}.</span>
              {row.white ? (
                <PlyCell
                  move={row.white}
                  index={row.whiteIndex}
                  cpDelta={gameAnalysis().cpDeltas[row.whiteIndex] ?? null}
                  tags={annotations()[row.whiteIndex] ?? []}
                  active={activePly() === row.whiteIndex}
                  onJump={() => jump(row.whiteIndex)}
                />
              ) : (
                <span />
              )}
              {row.black ? (
                <PlyCell
                  move={row.black}
                  index={row.blackIndex}
                  cpDelta={gameAnalysis().cpDeltas[row.blackIndex] ?? null}
                  tags={annotations()[row.blackIndex] ?? []}
                  active={activePly() === row.blackIndex}
                  onJump={() => jump(row.blackIndex)}
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
