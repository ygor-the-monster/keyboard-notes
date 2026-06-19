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
import type { Tool } from "../Toolbar/Toolbar.tsx";

interface NoteToolsArgs {
  t: (key: string, vars?: Record<string, unknown>) => string;
  format: (kind: string) => void;
}

// The Note (Markdown) editor's unified-Toolbar tools. Pure: every label reads through `t` and every
// action delegates to `format(id)`.
export function buildNoteTools({ t, format }: NoteToolsArgs): Tool[] {
  const act = (id: string, icon: Icon, key: string): Tool => ({
    kind: "action",
    id,
    icon,
    label: t(key),
    onUse: () => format(id),
  });
  return [
    // Inline formatting
    act("bold", TextB, "note.bold"),
    act("italic", TextItalic, "note.italic"),
    act("strike", TextStrikethrough, "note.strike"),
    act("code", Code, "note.code"),
    act("highlight", Highlighter, "note.highlight"),
    act("link", LinkSimple, "note.link"),
    act("superscript", TextSuperscript, "note.superscript"),
    act("subscript", TextSubscript, "note.subscript"),
    { kind: "sep" },
    // Block structure
    {
      kind: "group",
      id: "list",
      icon: ListBullets,
      label: t("note.list"),
      options: [
        { id: "ul", icon: ListBullets, label: t("note.bulletList"), onUse: () => format("ul") },
        { id: "ol", icon: ListNumbers, label: t("note.numberedList"), onUse: () => format("ol") },
        { id: "task", icon: ListChecks, label: t("note.taskList"), onUse: () => format("task") },
      ],
    },
    act("quote", Quotes, "note.blockquote"),
    {
      kind: "group",
      id: "heading",
      char: "H",
      label: t("note.heading"),
      options: [
        { id: "h1", char: "H1", label: t("note.h1"), onUse: () => format("h1") },
        { id: "h2", char: "H2", label: t("note.h2"), onUse: () => format("h2") },
        { id: "h3", char: "H3", label: t("note.h3"), onUse: () => format("h3") },
      ],
    },
    { kind: "sep" },
    // Inserts
    act("table", Table, "note.table"),
    act("codeblock", CodeBlock, "note.codeBlock"),
    {
      kind: "action",
      id: "footnote",
      char: "†",
      label: t("note.footnote"),
      onUse: () => format("footnote"),
    },
    act("hr", Minus, "note.divider"),
  ];
}
