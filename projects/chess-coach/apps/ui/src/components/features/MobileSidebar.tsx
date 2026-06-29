// SPEC: _spec/chess-coach/ui/components.puml
import clsx from "clsx";
import type { Component, JSX } from "solid-js";

import styles from "~/components/features/MobileSidebar.module.css";

/** The centred per-screen slot (coach avatar, engine depth, or blank for LAN). */
const Main: Component<{ children?: JSX.Element }> = (props) => (
  <span class={styles.main}>{props.children}</span>
);

/**
 * A control. Up to four render; CSS fans them out around the centre. Mark the
 * single nav control with `nav` so it survives `timeline` mode (and pass a
 * `ref` to drive the dock → top-right FLIP animation from the parent).
 */
const Item: Component<{
  children: JSX.Element;
  nav?: boolean;
  ref?: (el: HTMLDivElement) => void;
}> = (props) => (
  <div class={clsx(styles.item, props.nav && styles["nav-item"])} ref={props.ref}>
    {props.children}
  </div>
);

const Root: Component<{
  children: JSX.Element;
  timeline?: boolean;
  /** Let an oversized centre slot (the Coach avatar) overflow a slimmed bar. */
  centerOverflow?: boolean;
}> = (props) => (
  <div
    classList={{
      [styles.bar]: true,
      [styles.timeline]: !!props.timeline,
      [styles["center-overflow"]]: !!props.centerOverflow,
    }}
  >
    {props.children}
  </div>
);

/**
 * Mobile-only horizontal control bar above the board, shared by every board
 * screen. Compose it with one `<MobileSidebar.Main>` (centred) and up to four
 * `<MobileSidebar.Item>` controls. Positioning is entirely CSS: the single-
 * button items stack on the left of the centre slot by source order (1st sits
 * nearest the centre); any 5th+ item is dropped. The one `nav` item (the
 * double-wide history arrows) owns the right on its own — balancing the row of
 * single buttons and keeping the centre slot truly centred, whatever items are
 * capability-gated out. Hidden on desktop, where {@link Sidebar} takes over.
 *
 * In `timeline` mode (replay / travel) the bar collapses: `Main` and every
 * non-`nav` item are hidden and the lone `nav` item floats to the top-right
 * corner — so only the expanded history nav (arrows + title + Back to Live)
 * remains. See {@link BoardControls} for the FLIP animation between the two.
 */
export const MobileSidebar = Object.assign(Root, { Main, Item });
