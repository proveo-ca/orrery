import clsx from "clsx";
import { type JSX, Show } from "solid-js";

import styles from "~/components/primitives/Collapsible.module.css";
import { CheckIcon, ChevronRightIcon } from "~/components/primitives/icons";

interface CollapsibleProps {
  title: string;
  /** Whether the body is expanded (controlled). */
  open: boolean;
  onToggle: () => void;
  /** Optional 1-based step index shown in the leading badge. */
  index?: number;
  /** Marks the step complete: badge becomes a check, header reads as done. */
  done?: boolean;
  /** When set, the header can't be toggled (e.g. a step gated on a prior one). */
  disabled?: boolean;
  class?: string;
  children: JSX.Element;
}

/**
 * Themed collapsible section / accordion step. Controlled: the parent owns the
 * `open` state so several can be coordinated into a stepper (one open at a
 * time, auto-advance on completion). Used by TailscaleChecklist.
 */
export function Collapsible(props: CollapsibleProps) {
  return (
    <div
      class={clsx(styles.section, props.done && styles.done, props.class)}
      data-open={props.open}
    >
      <button
        type="button"
        class={styles.header}
        aria-expanded={props.open}
        disabled={props.disabled}
        onClick={() => !props.disabled && props.onToggle()}
      >
        <Show when={props.index != null}>
          <span class={styles.badge}>
            <Show when={props.done} fallback={props.index}>
              <CheckIcon size={14} />
            </Show>
          </span>
        </Show>
        <span class={styles.title}>{props.title}</span>
        <span class={clsx(styles.chevron, props.open && styles.chevronOpen)}>
          <ChevronRightIcon size={18} />
        </span>
      </button>
      <Show when={props.open}>
        <div class={styles.body}>{props.children}</div>
      </Show>
    </div>
  );
}
