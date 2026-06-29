// SPEC: _spec/chess-coach/ui/entities.puml
import { createEffect } from "solid-js";
import type { Accessor } from "solid-js";

/**
 * FLIP-animate an element between two layout positions whenever `trigger`
 * changes. Each run measures the element's box in a post-layout rAF and
 * animates from the previously-measured box to the new one — so it's robust to
 * Solid effect ordering (the class/layout change has settled by the rAF). Used
 * to slide the history nav between its in-bar dock and the top-right corner as
 * the {@link MobileSidebar} bar collapses on entering replay / travel.
 *
 * No-ops without WAAPI / requestAnimationFrame (e.g. jsdom) and under
 * `prefers-reduced-motion`.
 */
export function useFlip(el: Accessor<HTMLElement | undefined>, trigger: Accessor<unknown>): void {
  let prevRect: DOMRect | undefined;
  createEffect(() => {
    trigger(); // re-run on every position change
    const node = el();
    if (!node || typeof requestAnimationFrame !== "function") return;
    requestAnimationFrame(() => {
      const rect = node.getBoundingClientRect();
      const last = prevRect;
      prevRect = rect;
      if (!last || typeof node.animate !== "function") return;
      const dx = last.left - rect.left;
      const dy = last.top - rect.top;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
      if (typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches)
        return;
      node.animate(
        [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "translate(0, 0)" }],
        { duration: 340, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
      );
    });
  });
}
