// SPEC: _spec/chess-coach/ui/components.puml
import { For, Show } from "solid-js";
import type { Component } from "solid-js";

import { ColorSelector } from "~/components/common/ColorSelector";
import { ChevronLeftIcon, ChevronRightIcon } from "~/components/common/icons";
import styles from "~/components/GameHistoryFilters.module.css";

interface Props {
  colorFilter: "w" | "b";
  setColorFilter: (v: "w" | "b") => void;
  firstMoveFilter: string | null;
  setFirstMoveFilter: (san: string | null) => void;
  availableFirstMoves: string[];
  totalPages: number;
  activePage: number;
  currentDateLabel: string;
  goToPrev: () => void;
  goToNext: () => void;
}

export const GameHistoryFilters: Component<Props> = (props) => {
  return (
    <>
      <div class={styles.filters}>
        <div>
          <div class={styles.label}>Playing as</div>
          <ColorSelector
            value={props.colorFilter}
            onChange={(v) => {
              if (v === "random") return;
              props.setColorFilter(v);
              props.setFirstMoveFilter(null);
            }}
            hideRandom
          />
        </div>
        <Show when={props.availableFirstMoves.length > 0}>
          <div>
            <div class={styles.label}>First move</div>
            <div class={styles.firstMoves}>
              <button
                type="button"
                class={styles["page-btn"]}
                classList={{ [styles["tile--active"]]: props.firstMoveFilter === null }}
                onClick={() => props.setFirstMoveFilter(null)}
              >
                Any
              </button>
              <For each={props.availableFirstMoves}>
                {(san) => (
                  <button
                    type="button"
                    class={styles["page-btn"]}
                    classList={{ [styles["tile--active"]]: props.firstMoveFilter === san }}
                    onClick={() => props.setFirstMoveFilter(san)}
                  >
                    {san}
                  </button>
                )}
              </For>
            </div>
          </div>
        </Show>
      </div>

      {/* Date pagination - always shown to display the game date */}
      <Show when={props.totalPages >= 1 && props.currentDateLabel}>
        <div class={styles["page-nav"]}>
          <Show when={props.totalPages > 1}>
            <button
              class={styles["page-btn"]}
              onClick={props.goToPrev}
              disabled={props.activePage === 0}
              aria-label="Previous date"
            >
              <ChevronLeftIcon size={14} />
            </button>
          </Show>

          <span class={styles["page-indicator"]}>
            {props.currentDateLabel} ({props.activePage + 1} / {props.totalPages})
          </span>

          <Show when={props.totalPages > 1}>
            <button
              class={styles["page-btn"]}
              onClick={props.goToNext}
              disabled={props.activePage >= props.totalPages - 1}
              aria-label="Next date"
            >
              <ChevronRightIcon size={14} />
            </button>
          </Show>
        </div>
      </Show>
    </>
  );
};
