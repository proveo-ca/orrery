import type { JSX } from "solid-js";

/** Shared props for the Button primitive and its variants (e.g. IconButton). */
export interface ButtonProps extends JSX.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Filled primary-color background. */
  primary?: boolean;
  /** When set, renders a router `<A>` instead of a `<button>`. */
  href?: string;
}
