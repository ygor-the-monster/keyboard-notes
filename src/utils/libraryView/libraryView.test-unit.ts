import { describe, it, expect } from "vitest";
import { selectLibraryView } from "./libraryView.ts";
import type { AppState, Lesson } from "../cellKinds/cellKinds.ts";

const lesson = (over: Partial<Lesson> & { id: string }): Lesson => ({
  title: "",
  created: 0,
  updated: 0,
  cells: [],
  ...over,
});

// b (pinned), a, c — created/updated chosen so the three sorts give distinct orders.
const L = {
  a: lesson({ id: "a", title: "Scales", created: 100, updated: 300, tags: ["technique"] }),
  b: lesson({ id: "b", title: "Bach", created: 200, updated: 100, pinned: true, tags: ["bach", "repertoire"] }),
  c: lesson({ id: "c", title: "Czerny", created: 300, updated: 200, tags: ["technique"] }),
};
const state = (order = ["a", "b", "c"]): AppState => ({
  lessons: { a: L.a, b: L.b, c: L.c },
  order,
  activeId: "a",
});

const ids = (ls: Lesson[]) => ls.map((l) => l.id);
const base = { query: "", sort: "recent", activeTag: null } as const;

describe("selectLibraryView", () => {
  it("separates pinned from the rest", () => {
    const v = selectLibraryView(state(), base);
    expect(ids(v.pinned)).toEqual(["b"]);
    expect(ids(v.rest)).toEqual(["a", "c"]); // recent: a(300) before c(200)
    expect(v.total).toBe(3);
  });

  it("sorts the rest by recent / title / created", () => {
    expect(ids(selectLibraryView(state(), { ...base, sort: "recent" }).rest)).toEqual(["a", "c"]);
    expect(ids(selectLibraryView(state(), { ...base, sort: "title" }).rest)).toEqual(["c", "a"]); // Czerny < Scales
    expect(ids(selectLibraryView(state(), { ...base, sort: "created" }).rest)).toEqual(["c", "a"]); // 300 before 100
  });

  it("filters by title query, case-insensitively", () => {
    const v = selectLibraryView(state(), { ...base, query: "sca" });
    expect(ids([...v.pinned, ...v.rest])).toEqual(["a"]);
    expect(v.total).toBe(1);
  });

  it("filters by a single active tag across pinned and rest", () => {
    const v = selectLibraryView(state(), { ...base, activeTag: "technique" });
    expect(v.pinned).toHaveLength(0);
    expect(ids(v.rest)).toEqual(["a", "c"]);
  });

  it("reports all tags with counts over the whole library, regardless of the active filter", () => {
    const v = selectLibraryView(state(), { ...base, activeTag: "bach" });
    // counts are library-wide (technique x2, then alphabetical among ties)
    expect(v.allTags).toEqual([
      { tag: "technique", count: 2 },
      { tag: "bach", count: 1 },
      { tag: "repertoire", count: 1 },
    ]);
  });

  it("ignores ids in order that have no lesson", () => {
    const v = selectLibraryView(state(["a", "ghost", "b", "c"]), base);
    expect(v.total).toBe(3);
  });
});
