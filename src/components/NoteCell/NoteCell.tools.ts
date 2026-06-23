import { createElement } from "react";
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
  ClockIcon as Clock,
} from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";
import type { Tool } from "../Toolbar/Toolbar.tsx";
import { buildAssistantTool } from "../AssistantPanel/assistantTool.ts";
import { runTextTransform } from "../../utils/notationAssistant/notationAssistant.ts";
import TimestampAnchorPicker, { type SeekTarget } from "./TimestampAnchorPicker.tsx";

interface NoteToolsArgs {
  t: (key: string, vars?: Record<string, unknown>) => string;
  format: (kind: string) => void;
  sourceNow: () => string;
  applySource: (next: { source: string }) => void;
  // Timestamp Anchors — the lesson's seek-able media Cells (Audio + YouTube/Vimeo) and how to insert
  // an anchor to one. Optional: the tool only appears when the lesson has at least one such Cell.
  seekTargets?: SeekTarget[];
  insertAnchor?: (cellId: string, seconds: number, label: string) => void;
}

// The Note (Markdown) editor's unified-Toolbar tools. Pure: every label reads through `t` and every
// action delegates to `format(id)`.
export function buildNoteTools({
  t,
  format,
  sourceNow,
  applySource,
  seekTargets,
  insertAnchor,
}: NoteToolsArgs): Tool[] {
  const act = (id: string, icon: Icon, key: string): Tool => ({
    kind: "action",
    id,
    icon,
    label: t(key),
    onUse: () => format(id),
  });
  // Insert-a-timestamp-anchor tool — only when the lesson has a seek-able media Cell to point at.
  const timestampTool: Tool[] =
    seekTargets && seekTargets.length > 0 && insertAnchor
      ? [
          {
            kind: "input",
            id: "timestamp",
            icon: Clock,
            label: t("note.timestamp"),
            render: ({ close }) =>
              createElement(TimestampAnchorPicker, {
                targets: seekTargets,
                t,
                onInsert: insertAnchor,
                close,
              }),
          },
        ]
      : [];
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
    ...timestampTool,
    { kind: "sep" },
    // On-device assistant — last in the list (an optional power feature, not pushed up front).
    // Edits the Markdown from a plain-language instruction (see AssistantPanel).
    buildAssistantTool<{ source: string }>({
      t,
      hintKey: "assistant.hintNote",
      accent: "--s-purple", // matches cellRegistry note hue
      snapshot: () => ({ source: sourceNow() }),
      apply: applySource,
      transform: (instruction, onProgress, tier) =>
        runTextTransform("markdown", instruction, sourceNow(), onProgress, tier).then((source) => ({
          source,
        })),
    }),
  ];
}
