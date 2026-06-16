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
  DotsSixVertical,
} from "@phosphor-icons/react";
import { useStore } from "../../providers/StoreProvider/StoreProvider.jsx";
import { useEditing } from "../../providers/EditingProvider/EditingProvider.jsx";
import IconBtn from "../IconBtn/IconBtn.jsx";
import MarkdownCell from "../MarkdownCell/MarkdownCell.jsx";
import MusicCell from "../MusicCell/MusicCell.jsx";
import ImageCell from "../ImageCell/ImageCell.jsx";
import PdfCell from "../PdfCell/PdfCell.jsx";
import AudioCell from "../AudioCell/AudioCell.jsx";
import s from "./Cell.module.css";

const META = {
  md: { icon: Article, label: "Note", typeClass: "typeMd" },
  abc: { icon: MusicNotes, label: "Music", typeClass: "typeAbc" },
  img: { icon: ImageIcon, label: "Image", typeClass: "typeImg" },
  pdf: { icon: FilePdf, label: "PDF", typeClass: "typePdf" },
  snd: { icon: Waveform, label: "Audio", typeClass: "typeSnd" },
};

export default function Cell({ cell, index = 0 }) {
  const { moveCell, duplicateCell, deleteCell } = useStore();
  const { editingId } = useEditing();
  const editing = editingId === cell.id;
  const meta = META[cell.type] || META.md;
  const TagIcon = meta.icon;

  const cellClass = [s.cell, s[meta.typeClass], editing && s.editing].filter(Boolean).join(" ");

  return (
    <section
      className={cellClass}
      data-cell-id={cell.id}
      style={{ "--stagger": `${Math.min(index, 8) * 55}ms` }}
    >
      <div className={`${s.cellToolbar} no-print`}>
        <span className={s.tagGroup}>
          <span className={s.cellDrag} aria-hidden>
            <DotsSixVertical size={18} weight="bold" />
          </span>
          <span className={s.cellTag}>
            <TagIcon size={12} aria-hidden /> {meta.label}
          </span>
        </span>
        <div className={`${s.actions} no-print`} role="toolbar" aria-label="Cell actions">
          <IconBtn icon={CaretUp} label="Move up" onPress={() => moveCell(cell.id, -1)} />
          <IconBtn icon={CaretDown} label="Move down" onPress={() => moveCell(cell.id, 1)} />
          <IconBtn icon={Copy} label="Duplicate" onPress={() => duplicateCell(cell.id)} />
          <IconBtn
            icon={Trash}
            label="Delete cell"
            onPress={() => {
              if (confirm("Delete this cell?")) deleteCell(cell.id);
            }}
          />
        </div>
      </div>

      <div className="cell-body">
        {cell.type === "abc" ? (
          <MusicCell cell={cell} editing={editing} />
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
