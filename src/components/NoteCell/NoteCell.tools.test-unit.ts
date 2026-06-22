import { describe, it, expect, vi } from "vitest";
import { buildNoteTools } from "./NoteCell.tools.ts";
import type { GroupTool } from "../Toolbar/Toolbar.tsx";

const t = (k: string) => k;

describe("buildNoteTools", () => {
  it("leads with the inline-formatting actions, then the block groups, and ends with the assistant", () => {
    const tools = buildNoteTools({
      t,
      format: vi.fn(),
      sourceNow: () => "",
      applySource: () => {},
    });
    const ids = tools.map((x) => (x.kind === "sep" ? "|" : x.id));
    expect(ids).toEqual([
      "bold",
      "italic",
      "strike",
      "code",
      "highlight",
      "link",
      "superscript",
      "subscript",
      "|",
      "list",
      "quote",
      "heading",
      "|",
      "table",
      "codeblock",
      "footnote",
      "hr",
      "|",
      "assistant",
    ]);
  });

  it("routes every action through format(id)", () => {
    const format = vi.fn();
    const tools = buildNoteTools({ t, format, sourceNow: () => "", applySource: () => {} });
    const bold = tools.find((x) => x.kind !== "sep" && x.id === "bold");
    if (bold?.kind === "action") bold.onUse();
    expect(format).toHaveBeenCalledWith("bold");
  });

  it("nests the heading options h1/h2/h3", () => {
    const tools = buildNoteTools({
      t,
      format: vi.fn(),
      sourceNow: () => "",
      applySource: () => {},
    });
    const heading = tools.find((x) => x.kind !== "sep" && x.id === "heading") as GroupTool;
    expect(heading.options.map((o) => o.id)).toEqual(["h1", "h2", "h3"]);
  });

  it("reads labels through t (here the identity probe returns the key)", () => {
    const tools = buildNoteTools({
      t,
      format: vi.fn(),
      sourceNow: () => "",
      applySource: () => {},
    });
    const bold = tools.find((x) => x.kind !== "sep" && x.id === "bold");
    expect(bold && "label" in bold && bold.label).toBe("note.bold");
  });
});
