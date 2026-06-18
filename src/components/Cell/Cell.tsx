import { useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import {
  CaretUpIcon as CaretUp,
  CaretDownIcon as CaretDown,
  CopyIcon as Copy,
  TrashIcon as Trash,
  DotsSixVerticalIcon as DotsSixVertical,
} from "@phosphor-icons/react";
import { useStore } from "../../providers/StoreProvider/StoreProvider.tsx";
import { useEditing } from "../../providers/EditingProvider/EditingProvider.tsx";
import { useDialog } from "../../providers/DialogProvider/DialogProvider.tsx";
import { useI18n } from "../../providers/I18nProvider/I18nProvider.tsx";
import IconBtn from "../IconBtn/IconBtn.tsx";
import { cellRegistry } from "../../cells/registry.tsx";
import type { Cell as CellModel } from "../../cells/kinds.ts";
import s from "./Cell.module.css";

export default function Cell({ cell, index = 0 }: { cell: CellModel; index?: number }) {
  const { moveCell, moveCellTo, duplicateCell, deleteCell } = useStore();
  const { editingId } = useEditing();
  const { confirm } = useDialog();
  const { t } = useI18n();
  const editing = editingId === cell.id;
  const view = cellRegistry[cell.kind];
  const TagIcon = view.icon;
  const Body = view.component;

  // Pointer-based drag-to-reorder via the grip handle (touch-friendly). The list reorders
  // live, iOS-style. Move/up are bound to `window` (not the grip) so events keep flowing
  // even as the list re-renders mid-drag, and the target index is computed against the OTHER
  // cells so the dragged cell doesn't oscillate against its own midpoint.
  const [dragging, setDragging] = useState(false);
  function onGripDown(e: ReactPointerEvent) {
    e.preventDefault();
    setDragging(true);
    const scroller = (e.currentTarget.closest(".app-scroll") ||
      document.scrollingElement) as HTMLElement;
    let lastY = e.clientY;
    let raf = 0;

    // Reorder so the dragged cell lands at the slot the pointer is over (target computed
    // against the OTHER cells, so it never oscillates against its own midpoint).
    const reorder = (clientY: number) => {
      const others = [...document.querySelectorAll<HTMLElement>("[data-cell-id]")].filter(
        (el) => el.dataset.cellId !== cell.id,
      );
      let target = others.length;
      for (let k = 0; k < others.length; k++) {
        const r = others[k].getBoundingClientRect();
        if (clientY < r.top + r.height / 2) {
          target = k;
          break;
        }
      }
      moveCellTo(cell.id, target);
    };

    // Auto-scroll when the pointer nears the top/bottom edge of the scroll area, so a cell
    // can be dragged to a slot that's currently off-screen.
    const EDGE = 90; // px band where auto-scroll engages
    const MAX = 16; // px per frame at the very edge
    const tick = () => {
      const r = scroller.getBoundingClientRect?.() || { top: 0, bottom: window.innerHeight };
      const top = scroller === document.scrollingElement ? 0 : r.top;
      const bottom = scroller === document.scrollingElement ? window.innerHeight : r.bottom;
      let dy = 0;
      if (lastY < top + EDGE) dy = -MAX * Math.min(1, (top + EDGE - lastY) / EDGE);
      else if (lastY > bottom - EDGE) dy = MAX * Math.min(1, (lastY - (bottom - EDGE)) / EDGE);
      if (dy) {
        scroller.scrollTop += dy;
        reorder(lastY); // cells shifted under the pointer → re-evaluate the target
      }
      raf = requestAnimationFrame(tick);
    };

    const onMove = (ev: PointerEvent) => {
      lastY = ev.clientY;
      reorder(ev.clientY);
    };
    const onUp = () => {
      setDragging(false);
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    raf = requestAnimationFrame(tick);
  }

  const cellClass = [s.cell, s[view.typeClass], editing && s.editing, dragging && s.dragging]
    .filter(Boolean)
    .join(" ");

  return (
    <section
      className={cellClass}
      data-cell-id={cell.id}
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
          >
            <DotsSixVertical size={18} weight="bold" />
          </span>
          <span className={s.cellTag}>
            <TagIcon size={12} aria-hidden /> {t(view.tagLabelKey)}
          </span>
        </span>
        <div className={`${s.actions} no-print`} role="toolbar" aria-label={t("cell.actions")}>
          <IconBtn icon={CaretUp} label={t("cell.moveUp")} onPress={() => moveCell(cell.id, -1)} />
          <IconBtn
            icon={CaretDown}
            label={t("cell.moveDown")}
            onPress={() => moveCell(cell.id, 1)}
          />
          <IconBtn icon={Copy} label={t("cell.duplicate")} onPress={() => duplicateCell(cell.id)} />
          <IconBtn
            icon={Trash}
            label={t("cell.delete")}
            onPress={async () => {
              if (
                await confirm({
                  title: t("dialogs.deleteCellTitle"),
                  message: t("dialogs.deleteCellMsg"),
                  confirmLabel: t("common.delete"),
                  variant: "destructive",
                })
              )
                deleteCell(cell.id);
            }}
          />
        </div>
      </div>

      <div className="cell-body">
        <Body cell={cell} editing={editing} />
      </div>
    </section>
  );
}
