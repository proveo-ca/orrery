// SPEC: _spec/chess-coach/ui/components.puml
import clsx from "clsx";
import { type Component, type ParentComponent } from "solid-js";

import styles from "~/components/primitives/Screen.module.css";

interface ScreenProps {
  /** Applies the global `highlight` state class (travel / replay / review-analysis). */
  highlight?: boolean;
  children?: import("solid-js").JSX.Element;
}

interface RegionProps {
  /** Extra class names to append (e.g. the global `mobile-nav-clear`). */
  class?: string;
  children?: import("solid-js").JSX.Element;
}

/**
 * Shared gameplay-screen layout shell (Coach / Analysis / Review). Owns the
 * `app-container` grid and its regions so screens *compose* layout instead of
 * reaching into a shared stylesheet. Splash-style screens use SplashScreen.
 */
const ScreenRoot: Component<ScreenProps> = (props) => (
  <div classList={{ [styles["app-container"]]: true, highlight: !!props.highlight }}>
    {props.children}
  </div>
);

/** Row 1 (Coach): header strip sized to the avatar row. */
const Header: ParentComponent = (props) => (
  <div class={styles["coach-header"]}>{props.children}</div>
);

/** Row 1 (Analysis / Review): toolbar inset aligned to the board center. */
const SidebarInset: Component<RegionProps> = (props) => (
  <div class={clsx(styles["sidebar-inset"], props.class)}>{props.children}</div>
);

/** Row 2: the board row (board column + sidebar, or list + sidebar). */
const BoardArea: ParentComponent = (props) => (
  <div class={styles["board-area"]}>{props.children}</div>
);

/** The board stack (captures + board) within the board row. */
const BoardColumn: ParentComponent = (props) => (
  <div class={styles["board-column"]}>{props.children}</div>
);

/** Row 3: footer region (coach panel, move list, etc.). */
const Footer: ParentComponent = (props) => <div class={styles.footer}>{props.children}</div>;

export const Screen = Object.assign(ScreenRoot, {
  Header,
  SidebarInset,
  BoardArea,
  BoardColumn,
  Footer,
});
