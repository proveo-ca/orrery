// SPEC: _spec/chess-coach/ui/components.puml
import { For, Show } from "solid-js";
import type { Component } from "solid-js";

import { ColorSelector } from "~/components/common/ColorSelector";
import { ChevronLeftIcon, ChevronRightIcon } from "~/components/common/icons";
import styles from "~/components/GameHistoryList.module.css";

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
      {/* Filters */}
      <div style={{ display: "flex", "flex-direction": "column", gap: "0.5rem", "margin-bottom": "0.75rem" }}>
        <div>
          <div style={{ "font-size": "0.75rem", opacity: 0.6, "margin-bottom": "0.25rem" }}>Playing as</div>
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
            <div style={{ "font-size": "0.75rem", opacity: 0.6, "margin-bottom": "0.25rem" }}>First move</div>
            <div style={{ display: "flex", gap: "0.25rem", "flex-wrap": "wrap" }}>
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

      {/* Date pagination */}
      <Show when={props.totalPages > 1}>
        <div class={styles["page-nav"]}>
          <button class={styles["page-btn"]} onClick={props.goToPrev} disabled={props.activePage === 0} aria-label="Previous date">
            <ChevronLeftIcon size={14} />
          </button>
          <span class={styles["page-indicator"]}>
            {props.currentDateLabel} ({props.activePage + 1} / {props.totalPages})
          </span>
          <button class={styles["page-btn"]} onClick={props.goToNext} disabled={props.activePage >= props.totalPages - 1} aria-label="Next date">
            <ChevronRightIcon size={14} />
          </button>
        </div>
      </Show>
    </>
  );
};
