import { useEffect, useRef } from "react";
import { useStore } from "../../providers/StoreProvider/StoreProvider.tsx";
import { useI18n } from "../../providers/I18nProvider/I18nProvider.tsx";
import { useEditing } from "../../providers/EditingProvider/EditingProvider.tsx";
import { renderMarkdown, toggleTask, applyFormat } from "./NoteCell.utils.ts";
import { replaceTextarea } from "../../utils/textEditing/textEditing.ts";
import { buildNoteTools } from "./NoteCell.tools.ts";
import type { SeekTarget } from "./TimestampAnchorPicker.tsx";
import {
  buildSeekToken,
  cellSeekCode,
  findCellByCode,
  requestSeek,
} from "../../utils/seekBus/seekBus.ts";
import { detectProvider, isSeekableProvider } from "../ExternalCell/ExternalCell.utils.ts";
import EmptyState from "../EmptyState/EmptyState.tsx";
import Toolbar from "../Toolbar/Toolbar.tsx";
import type { CellOf } from "../../utils/cellKinds/cellKinds.ts";
import shared from "../../providers/ThemeProvider/ThemeProvider.module.css";

export default function NoteCell({ cell, editing }: { cell: CellOf<"note">; editing: boolean }) {
  const { updateCell, activeLesson } = useStore();
  const { t } = useI18n();
  const { setEditing } = useEditing();
  const taRef = useRef<HTMLTextAreaElement>(null);

  // Uncontrolled editor (keeps native undo); sync external source changes back in.
  useEffect(() => {
    const ta = taRef.current;
    if (ta && ta.value !== cell.source) ta.value = cell.source;
  }, [cell.source]);

  // Timestamp Anchors: the lesson's seek-able media Cells this Note can point at — every Audio Cell,
  // plus any External Cell holding a YouTube/Vimeo video (the providers with a deterministic start).
  // Each target carries its stable code (the `<code>` in the token) and a readable picker label.
  const seekTargets: SeekTarget[] = [];
  let audioN = 0;
  let videoN = 0;
  for (const c of activeLesson?.cells ?? []) {
    if (c.kind === "audio") {
      audioN++;
      seekTargets.push({ code: cellSeekCode(c), label: `${t("cell.audio")} ${audioN}` });
    } else if (c.kind === "external" && c.url) {
      const p = detectProvider(c.url);
      if (p && isSeekableProvider(p.id)) {
        videoN++;
        seekTargets.push({
          code: cellSeekCode(c),
          label: c.title?.trim() || `${t("cell.external")} ${videoN}`,
        });
      }
    }
  }

  // Insert a `[[code:time|label?]]` token at the cursor, as one undoable step.
  function insertAnchor(code: string, seconds: number, label: string) {
    const ta = taRef.current;
    if (!ta) return;
    const md = buildSeekToken(code, seconds, label);
    const next = ta.value.slice(0, ta.selectionStart) + md + ta.value.slice(ta.selectionEnd);
    const caret = ta.selectionStart + md.length;
    replaceTextarea(ta, next, caret, caret, (v) => updateCell(cell.id, { source: v }));
  }

  // Make rendered timestamp anchors live: a click jumps the target media Cell to the moment. The
  // anchor is a <button> with the Cell code + time in data-* attributes (no href, so the router
  // never sees a hash). We resolve the code to a Cell here (where the lesson is in scope). External
  // video plays in place; an Audio Cell's player only exists in edit mode, so open it first (the
  // seek is parked and delivered as the player mounts — see seekBus).
  function wireAnchors(node: HTMLElement) {
    node.querySelectorAll<HTMLButtonElement>("button.seek-anchor[data-seek-code]").forEach((btn) => {
      btn.onclick = () => {
        const code = btn.dataset.seekCode;
        const seconds = Number(btn.dataset.seekTime);
        if (!code || !Number.isFinite(seconds)) return;
        const target = findCellByCode(activeLesson?.cells ?? [], code);
        if (!target) return;
        if (target.kind === "audio") setEditing(target.id);
        requestSeek(target.id, seconds);
        document
          .querySelector(`[data-cell-id="${target.id}"]`)
          ?.scrollIntoView({ behavior: "smooth", block: "center" });
      };
    });
  }

  if (!editing) {
    if (!cell.source.trim()) return <EmptyState kind="note" title={t("cell.emptyNote")} compact />;
    const html = renderMarkdown(cell.source, cell.id);
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
          wireAnchors(node);
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
      <Toolbar
        label={t("cell.formatTools")}
        tools={buildNoteTools({
          t,
          format,
          sourceNow: () => taRef.current?.value ?? cell.source,
          applySource: (next) => updateCell(cell.id, next),
          seekTargets,
          insertAnchor,
        })}
      />
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
            dangerouslySetInnerHTML={{ __html: renderMarkdown(cell.source, cell.id) }}
            ref={(node) => {
              if (node) wireAnchors(node);
            }}
          />
        </div>
      )}
    </div>
  );
}
