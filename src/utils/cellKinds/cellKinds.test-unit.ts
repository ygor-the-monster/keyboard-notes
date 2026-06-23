import { describe, it, expect } from "vitest";
import {
  KINDS,
  cellKinds,
  defaultLesson,
  applyCellPatch,
  validateCell,
  coerceLesson,
} from "./cellKinds.ts";
import type { NoteCell, ScoreCell } from "./cellKinds.ts";

describe("cellKinds registry", () => {
  it("has a factory for every kind", () => {
    for (const k of KINDS) expect(cellKinds[k]).toBeDefined();
  });

  it("each factory builds a cell of its own kind", () => {
    for (const k of KINDS) expect(cellKinds[k].factory().kind).toBe(k);
  });

  it("factories produce unique ids", () => {
    const ids = KINDS.map((k) => cellKinds[k].factory().id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("registry keys match KINDS exactly (no drift)", () => {
    expect(Object.keys(cellKinds).sort()).toEqual([...KINDS].sort());
  });
});

describe("applyCellPatch", () => {
  it("applies a valid same-kind patch", () => {
    const cell = cellKinds.note.factory() as NoteCell;
    const next = applyCellPatch(cell, { source: "hello" } as Partial<NoteCell>);
    expect(next.source).toBe("hello");
    expect(next.id).toBe(cell.id);
    expect(next).not.toBe(cell); // new object, not mutated in place
  });

  it("never changes the kind discriminant", () => {
    const cell = cellKinds.note.factory() as NoteCell;
    const next = applyCellPatch(cell, { kind: "score" } as unknown as Partial<NoteCell>);
    expect(next.kind).toBe("note");
  });

  it("ignores the id and fields not belonging to the kind", () => {
    const cell = cellKinds.score.factory() as ScoreCell;
    const next = applyCellPatch(cell, {
      id: "evil",
      body: "abc",
      source: "not-a-score-field",
    } as unknown as Partial<ScoreCell>);
    expect(next.id).toBe(cell.id);
    expect(next.body).toBe("abc");
    expect((next as unknown as Record<string, unknown>).source).toBeUndefined();
  });
});

describe("validateCell", () => {
  it("returns null for non-objects and unknown kinds", () => {
    expect(validateCell(null)).toBeNull();
    expect(validateCell("x")).toBeNull();
    expect(validateCell({ kind: "bogus" })).toBeNull();
    expect(validateCell({})).toBeNull();
  });

  it("preserves a valid cell's id and fields", () => {
    const valid = { id: "abc", kind: "note", source: "hi" };
    const out = validateCell(valid) as NoteCell;
    expect(out.id).toBe("abc");
    expect(out.source).toBe("hi");
  });

  it("repairs missing/mistyped fields from the kind's defaults", () => {
    const out = validateCell({ kind: "score", header: 123 }) as ScoreCell;
    expect(out.kind).toBe("score");
    expect(typeof out.header).toBe("string"); // mistyped header → default
    expect(typeof out.body).toBe("string"); // missing body → default
    expect(typeof out.id).toBe("string"); // missing id → minted
  });
});

describe("coerceLesson", () => {
  it("returns null when there is no cells array", () => {
    expect(coerceLesson(null)).toBeNull();
    expect(coerceLesson({ title: "x" })).toBeNull();
  });

  it("drops invalid cells and reports the count", () => {
    const res = coerceLesson({
      title: "L",
      cells: [
        { id: "a", kind: "note", source: "ok" },
        { kind: "bogus" },
        "garbage",
      ],
    });
    expect(res).not.toBeNull();
    expect(res!.lesson.cells).toHaveLength(1);
    expect(res!.dropped).toBe(2);
  });

  it("coerces a non-string title to empty", () => {
    const res = coerceLesson({ title: 42, cells: [] });
    expect(res!.lesson.title).toBe("");
  });
});

describe("defaultLesson", () => {
  it("is empty, untitled, and timestamped", () => {
    const l = defaultLesson();
    expect(l.cells).toEqual([]);
    expect(l.title).toBe("");
    expect(l.created).toBeGreaterThan(0);
    expect(l.updated).toBe(l.created);
  });
});
