import { useState } from "react";
import {
  CaretUp,
  CaretDown,
  Copy,
  Trash,
  Article,
  MusicNotes,
  Image as ImageIcon,
  FilePdf,
  Waveform,
  Guitar,
  DotsSixVertical,
} from "@phosphor-icons/react";
import { useStore } from "../../providers/StoreProvider/StoreProvider.jsx";
import { useEditing } from "../../providers/EditingProvider/EditingProvider.jsx";
import { useDialog } from "../../providers/DialogProvider/DialogProvider.jsx";
import { useI18n } from "../../providers/I18nProvider/I18nProvider.jsx";
import IconBtn from "../IconBtn/IconBtn.jsx";
import MarkdownCell from "../MarkdownCell/MarkdownCell.jsx";
import MusicCell from "../MusicCell/MusicCell.jsx";
import ImageCell from "../ImageCell/ImageCell.jsx";
import PdfCell from "../PdfCell/PdfCell.jsx";
import AudioCell from "../AudioCell/AudioCell.jsx";
import CifraCell from "../CifraCell/CifraCell.jsx";
import s from "./Cell.module.css";

const META = {
  md: { icon: Article, labelKey: "cell.note", typeClass: "typeMd" },
  abc: { icon: MusicNotes, labelKey: "cell.music", typeClass: "typeAbc" },
  cifra: { icon: Guitar, labelKey: "cell.cifra", typeClass: "typeCifra" },
  img: { icon: ImageIcon, labelKey: "cell.image", typeClass: "typeImg" },
  pdf: { icon: FilePdf, labelKey: "cell.pdf", typeClass: "typePdf" },
  snd: { icon: Waveform, labelKey: "cell.audio", typeClass: "typeSnd" },
};

export default function Cell({ cell, index = 0 }) {
  const { moveCell, moveCellTo, duplicateCell, deleteCell } = useStore();
  const { editingId } = useEditing();
  const { confirm } = useDialog();
  const { t } = useI18n();
  const editing = editingId === cell.id;
  const meta = META[cell.type] || META.md;
  const TagIcon = meta.icon;

  // Pointer-based drag-to-reorder via the grip handle (touch-friendly). The list reorders
  // live, iOS-style. Move/up are bound to `window` (not the grip) so events keep flowing
  // even as the list re-renders mid-drag, and the target index is computed against the OTHER
  // cells so the dragged cell doesn't oscillate against its own midpoint.
  const [dragging, setDragging] = useState(false);
  function onGripDown(e) {
    e.preventDefault();
    setDragging(true);
    const scroller = e.currentTarget.closest(".app-scroll") || document.scrollingElement;
    let lastY = e.clientY;
    let raf = 0;

    // Reorder so the dragged cell lands at the slot the pointer is over (target computed
    // against the OTHER cells, so it never oscillates against its own midpoint).
    const reorder = (clientY) => {
      const others = [...document.querySelectorAll("[data-cell-id]")].filter(
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

    const onMove = (ev) => {
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

  const cellClass = [s.cell, s[meta.typeClass], editing && s.editing, dragging && s.dragging]
    .filter(Boolean)
    .join(" ");

  return (
    <section
      className={cellClass}
      data-cell-id={cell.id}
      style={{ "--stagger": `${Math.min(index, 8) * 55}ms` }}
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
            <TagIcon size={12} aria-hidden /> {t(meta.labelKey)}
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
        {cell.type === "abc" ? (
          <MusicCell cell={cell} editing={editing} />
        ) : cell.type === "cifra" ? (
          <CifraCell cell={cell} editing={editing} />
        ) : cell.type === "img" ? (
          <ImageCell cell={cell} editing={editing} />
        ) : cell.type === "pdf" ? (
          <PdfCell cell={cell} editing={editing} />
        ) : cell.type === "snd" ? (
          <AudioCell cell={cell} editing={editing} />
        ) : (
          <MarkdownCell cell={cell} editing={editing} />
        )}
      </div>
    </section>
  );
}
