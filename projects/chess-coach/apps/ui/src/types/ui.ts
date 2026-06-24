import type { JSX } from "solid-js";

/** Shared props for the Button primitive and its variants (e.g. IconButton). */
export interface ButtonProps extends JSX.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Filled primary-color background. */
  primary?: boolean;
  /** When set, renders a link instead of a `<button>` (router `<A>` for internal paths, native `<a>` for external/`target` links). */
  href?: string;
  /** Anchor target (e.g. `_blank`); its presence also forces a native `<a>`. */
  target?: string;
  /** Anchor rel (e.g. `noreferrer`). */
  rel?: string;
}
