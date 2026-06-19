import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useStore } from "../../providers/StoreProvider/StoreProvider.tsx";
import { useEditing } from "../../providers/EditingProvider/EditingProvider.tsx";
import { useI18n } from "../../providers/I18nProvider/I18nProvider.tsx";
import { cellRegistry } from "../../utils/cellRegistry/cellRegistry.tsx";
import s from "./CellRail.module.css";

// A slim right-edge navigator (minimap-in-spirit): one dot per cell, in the cell's own accent hue —
// small/faint off-screen, bigger/lit on-screen, and ringed (offset outline) when selected (the
// focused card). Tap a dot to scroll to that cell and focus it. Dots grow in / collapse out as cells
// are added/removed. Lives by the scrollbar like a code editor's minimap; the docks moved left.
const EXIT_MS = 220;

export default function CellRail() {
  const { activeLesson } = useStore();
  const { editingId, setEditing } = useEditing();
  const { t } = useI18n();
  const cells = activeLesson?.cells ?? [];
  // Stable dep for the reconcile effects — changes only when the cell set or order changes (not on
  // every render, and not on content-only edits, which the rail doesn't care about).
  const cellsKey = cells.map((c) => c.id).join("|");
  const [visible, setVisible] = useState<Set<string>>(new Set());
  // `rendered` is a superset of `cells`: a just-removed cell lingers (marked exiting) long enough to
  // animate out before leaving the rail. Restored cells (undo) cancel their pending exit.
  const [rendered, setRendered] = useState(cells);
  const timers = useRef<Map<string, number>>(new Map());
  const lessonRef = useRef(activeLesson?.id);

  // Track which cells are currently within the scroll viewport (the "on-screen" state).
  useEffect(() => {
    const scroller = document.querySelector<HTMLElement>(".app-scroll");
    if (!scroller || cells.length === 0) {
      setVisible(new Set());
      return;
    }
    const seen = new Set<string>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const id = (e.target as HTMLElement).dataset.cellId;
          if (!id) continue;
          if (e.isIntersecting) seen.add(id);
          else seen.delete(id);
        }
        setVisible(new Set(seen));
      },
      { root: scroller, threshold: 0 },
    );
    document.querySelectorAll<HTMLElement>("[data-cell-id]").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [cells.length, activeLesson?.id]);

  // Reconcile `rendered` with `cells`: keep just-removed cells around (to animate out), cancel
  // pending exits for cells that came back, and reset wholesale when the lesson changes.
  useEffect(() => {
    const curIds = new Set(cells.map((c) => c.id));
    if (lessonRef.current !== activeLesson?.id) {
      lessonRef.current = activeLesson?.id;
      timers.current.forEach((tid) => clearTimeout(tid));
      timers.current.clear();
      setRendered(cells);
      return;
    }
    for (const [id, tid] of timers.current) {
      if (curIds.has(id)) {
        clearTimeout(tid);
        timers.current.delete(id);
      }
    }
    setRendered((prev) => {
      if (prev.every((p) => curIds.has(p.id)) && prev.length === cells.length) return cells;
      const out = cells.slice();
      prev.forEach((p, i) => {
        if (!curIds.has(p.id)) out.splice(Math.min(i, out.length), 0, p);
      });
      return out;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cellsKey, activeLesson?.id]);

  // Schedule removal of lingering (exiting) entries once their collapse animation has played.
  useEffect(() => {
    const curIds = new Set(cells.map((c) => c.id));
    for (const r of rendered) {
      if (!curIds.has(r.id) && !timers.current.has(r.id)) {
        const tid = window.setTimeout(() => {
          timers.current.delete(r.id);
          setRendered((cur) => cur.filter((x) => x.id !== r.id));
        }, EXIT_MS);
        timers.current.set(r.id, tid);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rendered, cellsKey]);

  useEffect(() => {
    const map = timers.current;
    return () => map.forEach((tid) => clearTimeout(tid));
  }, []);

  if (rendered.length === 0) return null;

  // Scroll to the cell and focus it (enter its editor), mirroring a click on the card.
  const go = (id: string) => {
    document.querySelector(`[data-cell-id="${id}"]`)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
    setEditing(id);
  };

  return (
    <nav className={`${s.rail} no-print`} data-cell-rail aria-label={t("rail.label")}>
      {rendered.map((c, i) => {
        const view = cellRegistry[c.kind];
        const exiting = !cells.some((x) => x.id === c.id);
        // Visibility (size) and selection (ring) are independent; both classes can apply at once.
        const cls = [
          visible.has(c.id) && s.onScreen,
          c.id === editingId && s.selected,
          exiting && s.exiting,
        ]
          .filter(Boolean)
          .join(" ");
        return (
          <button
            key={c.id}
            type="button"
            className={`${s.seg} ${cls}`}
            style={{ "--seg": `var(${view.hue.base})` } as CSSProperties}
            onClick={() => go(c.id)}
            aria-label={`${i + 1}. ${t(view.tagLabelKey)}`}
            aria-current={c.id === editingId ? "true" : undefined}
          >
            <span className={s.dot} />
          </button>
        );
      })}
    </nav>
  );
}
