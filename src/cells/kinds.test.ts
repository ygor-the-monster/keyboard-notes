import { describe, it, expect } from "vitest";
import { KINDS, cellKinds, defaultLesson } from "./kinds.ts";

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

describe("defaultLesson", () => {
  it("is empty, untitled, and timestamped", () => {
    const l = defaultLesson();
    expect(l.cells).toEqual([]);
    expect(l.title).toBe("");
    expect(l.created).toBeGreaterThan(0);
    expect(l.updated).toBe(l.created);
  });
});
