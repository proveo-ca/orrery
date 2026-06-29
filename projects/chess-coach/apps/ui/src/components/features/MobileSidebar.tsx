// SPEC: _spec/chess-coach/ui/components.puml
import type { Component, JSX } from "solid-js";

import styles from "~/components/features/MobileSidebar.module.css";

/** The centred per-screen slot (coach avatar, engine depth, or blank for LAN). */
const Main: Component<{ children?: JSX.Element }> = (props) => (
  <span class={styles.main}>{props.children}</span>
);

/** A control. Up to four render; CSS fans them out around the centre. */
const Item: Component<{ children: JSX.Element }> = (props) => (
  <div class={styles.item}>{props.children}</div>
);

const Root: Component<{ children: JSX.Element }> = (props) => (
  <div class={styles.bar}>{props.children}</div>
);

/**
 * Mobile-only horizontal control bar above the board, shared by every board
 * screen. Compose it with one `<MobileSidebar.Main>` (centred) and up to four
 * `<MobileSidebar.Item>` controls. Positioning is entirely CSS: items fan out
 * around the centre by source order — 1st → inner-left, 2nd → inner-right,
 * 3rd → outer-left, 4th → outer-right — and any 5th+ item is dropped. Hidden on
 * desktop, where the vertical {@link Sidebar} takes over.
 */
export const MobileSidebar = Object.assign(Root, { Main, Item });
