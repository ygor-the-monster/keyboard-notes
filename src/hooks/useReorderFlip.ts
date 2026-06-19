import { useLayoutEffect, useRef, type RefObject } from "react";

// FLIP-animate the cell list when the order changes (drag-reorder or the ▲▼ buttons), so cells slide
// into their new slot. Only elements with `[data-cell-id]` are touched (positions read from
// `offsetTop`, which is transform-immune) — so the drag ghost (no data-cell-id) is never animated,
// and the cell being dragged (`[data-dragging]`) is skipped (it follows the pointer). Honors
// prefers-reduced-motion. `orderKey` must change whenever the order does.
export function useReorderFlip(container: RefObject<HTMLElement | null>, orderKey: string): void {
  const prev = useRef<Map<string, number>>(new Map());

  useLayoutEffect(() => {
    const el = container.current;
    if (!el) return;
    const items = [...el.querySelectorAll<HTMLElement>("[data-cell-id]")];
    const next = new Map<string, number>();
    for (const it of items) next.set(it.dataset.cellId ?? "", it.offsetTop);

    const reduce =
      typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!reduce) {
      for (const it of items) {
        const id = it.dataset.cellId ?? "";
        const before = prev.current.get(id);
        const after = next.get(id);
        if (before == null || after == null || before === after) continue;
        if (it.hasAttribute("data-dragging")) continue; // dragged cell snaps under the pointer
        it.style.transition = "none";
        it.style.transform = `translateY(${before - after}px)`;
        requestAnimationFrame(() => {
          it.style.transition = "transform 200ms cubic-bezier(0.33, 1, 0.68, 1)";
          it.style.transform = "";
        });
      }
    }
    prev.current = next;
  }, [container, orderKey]);
}
