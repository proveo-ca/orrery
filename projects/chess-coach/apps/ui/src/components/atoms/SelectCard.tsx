import { Show } from "solid-js";
import type { Component, JSX } from "solid-js";

import styles from "~/components/atoms/SelectCard.module.css";

interface SelectCardProps {
  /** Small uppercase header, e.g. "White" / "Play". */
  label: string;
  /** Highlight as the chosen / owned card. */
  selected?: boolean;
  /** When set, the whole card is a selectable button. Omit for a static card
   *  that hosts its own action button(s) inside `children` (e.g. Take / Swap). */
  onClick?: () => void;
  testId?: string;
  children: JSX.Element;
}

/**
 * A bordered, selectable card used for the LAN lobby's White/Black seats and
 * the guest's Play/Spectate choice. With `onClick` the whole card is a button
 * (role selection); without it the card is static and hosts its own buttons.
 */
export const SelectCard: Component<SelectCardProps> = (props) => {
  const body = () => (
    <>
      <span class={styles.label}>{props.label}</span>
      {props.children}
    </>
  );
  return (
    <Show
      when={props.onClick}
      fallback={
        <div
          class={styles.card}
          classList={{ [styles.selected]: !!props.selected }}
          data-testid={props.testId}
        >
          {body()}
        </div>
      }
    >
      <button
        type="button"
        class={styles.card}
        classList={{ [styles.selected]: !!props.selected }}
        aria-pressed={props.selected}
        onClick={() => props.onClick?.()}
        data-testid={props.testId}
      >
        {body()}
      </button>
    </Show>
  );
};
