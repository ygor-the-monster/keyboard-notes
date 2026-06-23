import {
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  CaretUpIcon as CaretUp,
  CaretDownIcon as CaretDown,
  CopyIcon as Copy,
  TrashIcon as Trash,
  DotsSixVerticalIcon as DotsSixVertical,
} from "@phosphor-icons/react";
import { toast } from "../Toasts/toasts.ts";
import { removeDeleted } from "../../utils/recentlyDeleted/recentlyDeleted.ts";
import { useStore } from "../../providers/StoreProvider/StoreProvider.tsx";
import { useEditing } from "../../providers/EditingProvider/EditingProvider.tsx";
import { useI18n } from "../../providers/I18nProvider/I18nProvider.tsx";
import IconBtn from "../IconBtn/IconBtn.tsx";
import EmptyState from "../EmptyState/EmptyState.tsx";
import CellErrorBoundary from "../CellErrorBoundary/CellErrorBoundary.tsx";
import { cellRegistry } from "../../utils/cellRegistry/cellRegistry.tsx";
import { dropIndex } from "./Cell.dnd.ts";
import type { Cell as CellModel } from "../../utils/cellKinds/cellKinds.ts";
import shared from "../../providers/ThemeProvider/ThemeProvider.module.css";
import s from "./Cell.module.css";

const EDGE = 90; // px band near the scroll edge where auto-scroll engages
const MAX = 16; // px per frame at the very edge
const EXIT_MS = 200; // cell delete fade-out before it leaves the store — must match cell-out in CSS

// The translateY (px) a cell currently has from CSS, so the drop-target maths can read its SETTLED
// position even mid-transition.
function translateYOf(el: Element): number {
  const tf = getComputedStyle(el).transform;
  if (!tf || tf === "none") return 0;
  const n = tf
    .slice(tf.indexOf("(") + 1, -1)
    .split(",")
    .map(Number);
  return n.length === 6 ? n[5] : n.length === 16 ? n[13] : 0;
}

export default function Cell({ cell, index = 0 }: { cell: CellModel; index?: number }) {
  const { moveCell, moveCellTo, duplicateCell, deleteCell, restoreCell } = useStore();
  const { editingId, setEditing } = useEditing();
  const { t } = useI18n();
  const editing = editingId === cell.id;
  const view = cellRegistry[cell.kind];
  const TagIcon = view.icon;
  const Body = view.component;

  // Drag-to-reorder via the grip handle. Pointer/touch moves are tracked on `window` (NOT via pointer
  // capture or useMove) so the listeners survive the dragged cell's own DOM node being reordered
  // mid-drag — binding to the moving element ends the drag after a single reorder. The list reorders
  // live, iOS-style; the lifted card sticks to the pointer (a `--stick` translate) and leaves a
  // dotted accent ghost pinned to the slot it would drop into; neighbours snap out of the way. The
  // target is computed against the OTHER cells' settled midpoints, so a fast drag jumps many slots.
  // Keyboard reorder is handled separately (arrow keys on the focused grip → moveCell).
  const [dragging, setDragging] = useState(false);
  const [exiting, setExiting] = useState(false);
  const cellRef = useRef<HTMLElement>(null);
  const ghostRef = useRef<HTMLDivElement>(null);
  const stick = useRef(0);
  const drag = useRef<{ scroller: HTMLElement; raf: number; y: number } | null>(null);

  // Reorder so the dragged cell lands at the slot the pointer (viewport Y) is over.
  const reorderTo = (clientY: number) => {
    const rects = [...document.querySelectorAll<HTMLElement>("[data-cell-id]")]
      .filter((el) => el.dataset.cellId !== cell.id)
      .map((el) => {
        const r = el.getBoundingClientRect();
        return { top: r.top, height: r.height, ty: translateYOf(el) };
      });
    moveCellTo(cell.id, dropIndex(rects, clientY));
  };

  // Glue the lifted card to the pointer and keep the ghost pinned to the (possibly just-reordered)
  // slot. Runs every frame while dragging.
  const follow = () => {
    const el = cellRef.current;
    const d = drag.current;
    if (!el || !d) return;
    const r = el.getBoundingClientRect();
    // The card's scale is centre-origin, so its centre = layout centre + the applied --stick. Recover
    // the untransformed layout box, glue the card's centre to the pointer, and pin the ghost to the
    // slot (its own element, behind the card, so it's unaffected by the card's transform).
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const layoutCenterY = r.top + r.height / 2 - stick.current;
    stick.current = d.y - layoutCenterY;
    el.style.setProperty("--stick", `${stick.current}px`);
    const g = ghostRef.current;
    if (g) {
      g.style.top = `${layoutCenterY - h / 2}px`;
      g.style.left = `${r.left + r.width / 2 - w / 2}px`;
      g.style.width = `${w}px`;
      g.style.height = `${h}px`;
    }
  };

  function onGripDown(e: ReactPointerEvent) {
    if (e.button !== 0) return;
    e.preventDefault();
    setDragging(true);
    stick.current = 0;
    const scroller = (e.currentTarget.closest(".app-scroll") ||
      document.scrollingElement) as HTMLElement;
    const state = { scroller, raf: 0, y: e.clientY };
    drag.current = state;

    const onMove = (ev: PointerEvent) => {
      state.y = ev.clientY;
      reorderTo(ev.clientY);
    };
    // Auto-scroll when the pointer nears the top/bottom edge, so a cell can be dropped off-screen.
    const tick = () => {
      const d = drag.current;
      if (!d) return;
      const r = d.scroller.getBoundingClientRect?.() || { top: 0, bottom: window.innerHeight };
      const top = d.scroller === document.scrollingElement ? 0 : r.top;
      const bottom = d.scroller === document.scrollingElement ? window.innerHeight : r.bottom;
      let dy = 0;
      if (d.y < top + EDGE) dy = -MAX * Math.min(1, (top + EDGE - d.y) / EDGE);
      else if (d.y > bottom - EDGE) dy = MAX * Math.min(1, (d.y - (bottom - EDGE)) / EDGE);
      if (dy) {
        d.scroller.scrollTop += dy;
        reorderTo(d.y);
      }
      follow();
      d.raf = requestAnimationFrame(tick);
    };
    const end = () => {
      cancelAnimationFrame(state.raf);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("blur", end);
      drag.current = null;
      setDragging(false);
      cellRef.current?.style.removeProperty("--stick"); // let the card settle back into its slot
      stick.current = 0;
    };
    // Escape aborts the drag; so does the window losing focus (e.g. a tool screen opening, or the
    // tab being switched) — otherwise the document-level listeners would linger past the gesture.
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") end();
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
    window.addEventListener("keydown", onKey);
    window.addEventListener("blur", end);
    state.raf = requestAnimationFrame(tick);
  }

  function onGripKey(e: ReactKeyboardEvent) {
    if (e.key === "ArrowUp") {
      e.preventDefault();
      moveCell(cell.id, -1);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      moveCell(cell.id, 1);
    }
  }

  const cellClass = [
    s.cell,
    s[view.typeClass],
    editing && s.editing,
    dragging && s.dragging,
    exiting && s.exiting,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <>
      <section
        ref={cellRef}
        className={cellClass}
        data-cell-id={cell.id}
        data-dragging={dragging ? "" : undefined}
        style={{ "--stagger": `${Math.min(index, 8) * 55}ms` } as CSSProperties}
      >
        <div className={`${s.cellToolbar} no-print`}>
          <span className={s.tagGroup}>
            <span
              className={s.cellDrag}
              role="button"
              tabIndex={0}
              aria-label={t("cell.drag")}
              onPointerDown={onGripDown}
              onKeyDown={onGripKey}
            >
              <DotsSixVertical size={18} weight="bold" />
            </span>
            <span className={s.cellTag}>
              <TagIcon size={12} aria-hidden /> {t(view.tagLabelKey)}
            </span>
          </span>
          <div className={`${s.actions} no-print`} role="toolbar" aria-label={t("cell.actions")}>
            <IconBtn
              icon={CaretUp}
              label={t("cell.moveUp")}
              onPress={() => moveCell(cell.id, -1)}
            />
            <IconBtn
              icon={CaretDown}
              label={t("cell.moveDown")}
              onPress={() => moveCell(cell.id, 1)}
            />
            <IconBtn
              icon={Copy}
              label={t("cell.duplicate")}
              onPress={() => {
                const newId = duplicateCell(cell.id);
                if (newId)
                  toast.neutral(t("toast.duplicated", { kind: t(view.tagLabelKey) }), {
                    actionLabel: t("undo.action"),
                    onAction: () => deleteCell(newId),
                    timeout: 7000,
                    accent: `var(${view.hue.base})`,
                  });
              }}
            />
            <IconBtn
              icon={Trash}
              label={t("cell.delete")}
              onPress={() => {
                // No confirm dialog — one tap, recoverable via the undo toast. Fade the cell out
                // first, then remove it from the store (the FLIP then closes the gap).
                if (exiting) return;
                setExiting(true);
                window.setTimeout(() => {
                  const deleted = deleteCell(cell.id);
                  if (deleted)
                    toast.neutral(t("undo.deleted", { kind: t(view.tagLabelKey) }), {
                      actionLabel: t("undo.action"),
                      onAction: () => {
                        restoreCell(deleted);
                        removeDeleted(deleted.cell.id); // also clear it from the Recently Deleted bin
                      },
                      timeout: 7000,
                      accent: `var(${view.hue.base})`,
                    });
                }, EXIT_MS);
              }}
            />
          </div>
        </div>

        <div className="cell-body">
          <CellErrorBoundary
            resetKeys={[cell]}
            fallback={(retry, error) => (
              <EmptyState
                kind={cell.kind}
                neutral
                title={t("cell.errBoundaryTitle")}
                hint={t("cell.errBoundaryHint")}
              >
                <div className={s.errActions}>
                  <button type="button" className={shared.btnSecondary} onClick={() => setEditing(cell.id)}>
                    {t("cell.errBoundaryEdit")}
                  </button>
                  <button type="button" className={shared.btnSecondary} onClick={retry}>
                    {t("cell.errBoundaryRetry")}
                  </button>
                </div>
                {error?.message && (
                  <details className={s.errDetails}>
                    <summary>{t("cell.errBoundaryDetails")}</summary>
                    <pre className={s.errMessage}>{error.message}</pre>
                  </details>
                )}
              </EmptyState>
            )}
          >
            <Body cell={cell} editing={editing} />
          </CellErrorBoundary>
        </div>
      </section>
      {dragging && (
        <div ref={ghostRef} className={`${s.dragGhost} ${s[view.typeClass]}`} aria-hidden />
      )}
    </>
  );
}
