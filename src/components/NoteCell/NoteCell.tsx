import { useEffect, useRef } from "react";
import {
  TextBIcon as TextB,
  TextItalicIcon as TextItalic,
  TextStrikethroughIcon as TextStrikethrough,
  CodeIcon as Code,
  CodeBlockIcon as CodeBlock,
  HighlighterIcon as Highlighter,
  TextSuperscriptIcon as TextSuperscript,
  TextSubscriptIcon as TextSubscript,
  ListBulletsIcon as ListBullets,
  ListNumbersIcon as ListNumbers,
  ListChecksIcon as ListChecks,
  QuotesIcon as Quotes,
  LinkSimpleIcon as LinkSimple,
  TableIcon as Table,
  MinusIcon as Minus,
} from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";
import { useStore } from "../../providers/StoreProvider/StoreProvider.tsx";
import { useI18n } from "../../providers/I18nProvider/I18nProvider.tsx";
import { renderMarkdown, toggleTask, applyFormat, replaceTextarea } from "./NoteCell.utils.ts";
import EmptyState from "../EmptyState/EmptyState.tsx";
import Toolbar from "../Toolbar/Toolbar.tsx";
import type { Tool } from "../Toolbar/Toolbar.tsx";
import type { CellOf } from "../../utils/cellKinds/cellKinds.ts";
import shared from "../../providers/ThemeProvider/ThemeProvider.module.css";

export default function NoteCell({ cell, editing }: { cell: CellOf<"note">; editing: boolean }) {
  const { updateCell } = useStore();
  const { t, localizeTools } = useI18n();
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

  const act = (id: string, icon: Icon, label: string): Tool => ({
    kind: "action",
    id,
    icon,
    label,
    onUse: () => format(id),
  });
  const tools: Tool[] = [
    // Inline formatting
    act("bold", TextB, "Bold"),
    act("italic", TextItalic, "Italic"),
    act("strike", TextStrikethrough, "Strikethrough"),
    act("code", Code, "Inline code"),
    act("highlight", Highlighter, "Highlight"),
    act("link", LinkSimple, "Link"),
    act("superscript", TextSuperscript, "Superscript"),
    act("subscript", TextSubscript, "Subscript"),
    { kind: "sep" },
    // Block structure
    {
      kind: "group",
      id: "list",
      icon: ListBullets,
      label: "List",
      options: [
        { id: "ul", icon: ListBullets, label: "Bullet list", onUse: () => format("ul") },
        { id: "ol", icon: ListNumbers, label: "Numbered list", onUse: () => format("ol") },
        { id: "task", icon: ListChecks, label: "Task list", onUse: () => format("task") },
      ],
    },
    act("quote", Quotes, "Blockquote"),
    {
      kind: "group",
      id: "heading",
      char: "H",
      label: "Heading",
      options: [
        { id: "h1", char: "H1", label: "Heading 1", onUse: () => format("h1") },
        { id: "h2", char: "H2", label: "Heading 2", onUse: () => format("h2") },
        { id: "h3", char: "H3", label: "Heading 3", onUse: () => format("h3") },
      ],
    },
    { kind: "sep" },
    // Inserts
    act("table", Table, "Table"),
    act("codeblock", CodeBlock, "Code block"),
    {
      kind: "action",
      id: "footnote",
      char: "†",
      label: "Footnote",
      onUse: () => format("footnote"),
    },
    act("hr", Minus, "Divider"),
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", rowGap: 8 }}>
      <Toolbar label={t("cell.formatTools")} tools={localizeTools(tools)} />
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
