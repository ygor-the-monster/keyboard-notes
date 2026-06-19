import { useEffect, useRef } from "react";
import { useStore } from "../../providers/StoreProvider/StoreProvider.tsx";
import { useI18n } from "../../providers/I18nProvider/I18nProvider.tsx";
import { renderMarkdown, toggleTask, applyFormat } from "./NoteCell.utils.ts";
import { replaceTextarea } from "../../utils/textEditing/textEditing.ts";
import { buildNoteTools } from "./NoteCell.tools.ts";
import EmptyState from "../EmptyState/EmptyState.tsx";
import Toolbar from "../Toolbar/Toolbar.tsx";
import type { CellOf } from "../../utils/cellKinds/cellKinds.ts";
import shared from "../../providers/ThemeProvider/ThemeProvider.module.css";

export default function NoteCell({ cell, editing }: { cell: CellOf<"note">; editing: boolean }) {
  const { updateCell } = useStore();
  const { t } = useI18n();
  const taRef = useRef<HTMLTextAreaElement>(null);

  // Uncontrolled editor (keeps native undo); sync external source changes back in.
  useEffect(() => {
    const ta = taRef.current;
    if (ta && ta.value !== cell.source) ta.value = cell.source;
  }, [cell.source]);

  if (!editing) {
    if (!cell.source.trim()) return <EmptyState kind="note" title={t("cell.emptyNote")} compact />;
    const html = renderMarkdown(cell.source);
    return (
      <div
        className="md-preview"
        dangerouslySetInnerHTML={{
          __html: html || `<p style="opacity:.6">${t("cell.emptyNote")}</p>`,
        }}
        ref={(node) => {
          if (!node) return;
          let i = 0;
          node.querySelectorAll<HTMLInputElement>('input[type="checkbox"]').forEach((box) => {
            const idx = i++;
            box.disabled = false;
            box.onchange = () =>
              updateCell(cell.id, { source: toggleTask(cell.source, idx, box.checked) });
          });
        }}
      />
    );
  }

  function format(kind: string) {
    const ta = taRef.current;
    if (!ta) return;
    const { value, selStart, selEnd } = applyFormat(
      ta.value,
      ta.selectionStart,
      ta.selectionEnd,
      kind,
    );
    // Replace as one undoable step so Cmd/Ctrl+Z reverts the whole formatting action.
    replaceTextarea(ta, value, selStart, selEnd, (v) => updateCell(cell.id, { source: v }));
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", rowGap: 8 }}>
      <Toolbar label={t("cell.formatTools")} tools={buildNoteTools({ t, format })} />
      <textarea
        ref={taRef}
        className={`${shared.codeMono} no-print`}
        aria-label={t("cell.noteSource")}
        spellCheck
        defaultValue={cell.source}
        placeholder={t("cell.notePlaceholder")}
        rows={Math.max(4, cell.source.split("\n").length + 1)}
        onChange={(e) => updateCell(cell.id, { source: e.target.value })}
        autoFocus
        style={{ marginTop: 4 }}
      />
      {cell.source.trim() && (
        <div className={`${shared.previewCard} no-print`}>
          <span className={shared.previewLabel}>{t("cell.preview")}</span>
          <div
            className="md-preview"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(cell.source) }}
          />
        </div>
      )}
    </div>
  );
}
