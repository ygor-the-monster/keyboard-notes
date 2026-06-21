import { describe, it, expect } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { StoreProvider, useStore } from "./StoreProvider.tsx";
import { serializeLesson } from "../../utils/lessonExport/lessonExport.ts";
import type { Cell } from "../../utils/cellKinds/cellKinds.ts";

// The store hydrates from IndexedDB (provided in jsdom by fake-indexeddb, see test/setup-unit.ts),
// creating one empty default Lesson when storage is empty. Tests assert deltas against that
// hydrated baseline so they don't depend on debounced-save timing across tests.
const wrapper = ({ children }: { children: ReactNode }) => (
  <StoreProvider>{children}</StoreProvider>
);

async function mountStore() {
  const view = renderHook(() => useStore(), { wrapper });
  await waitFor(() => expect(view.result.current.hydrated).toBe(true));
  expect(view.result.current.activeLesson).not.toBeNull();
  return view;
}

const noteSourceOf = (cells: Cell[] | undefined, id: string) => {
  const c = cells?.find((x) => x.id === id);
  return c?.kind === "note" ? c.source : undefined;
};

describe("StoreProvider / useStore", () => {
  it("hydrates to a single empty default Lesson", async () => {
    const { result } = await mountStore();
    expect(result.current.activeLesson?.cells).toHaveLength(0);
  });

  it("addCell appends a cell of the requested kind and returns its id", async () => {
    const { result } = await mountStore();
    const base = result.current.activeLesson!.cells.length;
    let id = "";
    act(() => {
      id = result.current.addCell("note");
    });
    expect(result.current.activeLesson!.cells).toHaveLength(base + 1);
    const added = result.current.activeLesson!.cells.find((c) => c.id === id);
    expect(added?.kind).toBe("note");
  });

  it("updateCell patches the targeted cell in place", async () => {
    const { result } = await mountStore();
    let id = "";
    act(() => {
      id = result.current.addCell("note");
    });
    act(() => result.current.updateCell(id, { source: "## Hello" }));
    expect(noteSourceOf(result.current.activeLesson?.cells, id)).toBe("## Hello");
  });

  it("duplicateCell inserts a copy with a fresh id right after the original", async () => {
    const { result } = await mountStore();
    let id = "";
    act(() => {
      id = result.current.addCell("note");
    });
    act(() => result.current.updateCell(id, { source: "dup me" }));
    const before = result.current.activeLesson!.cells.length;
    act(() => result.current.duplicateCell(id));
    const cells = result.current.activeLesson!.cells;
    expect(cells).toHaveLength(before + 1);
    const i = cells.findIndex((c) => c.id === id);
    expect(cells[i + 1].id).not.toBe(id);
    expect(noteSourceOf(cells, cells[i + 1].id)).toBe("dup me");
  });

  it("moveCell reorders within bounds and is a no-op past the ends", async () => {
    const { result } = await mountStore();
    let a = "";
    let b = "";
    act(() => {
      a = result.current.addCell("note");
    });
    act(() => {
      b = result.current.addCell("score");
    });
    act(() => result.current.moveCell(b, -1)); // b before a
    const ids = result.current.activeLesson!.cells.map((c) => c.id);
    expect(ids.indexOf(b)).toBeLessThan(ids.indexOf(a));
    act(() => result.current.moveCell(b, -1)); // already first → no-op
    expect(result.current.activeLesson!.cells.map((c) => c.id)).toEqual(ids);
  });

  it("deleteCell returns the removed cell and restoreCell puts it back at its index", async () => {
    const { result } = await mountStore();
    let keep = "";
    let gone = "";
    act(() => {
      keep = result.current.addCell("note");
    });
    act(() => {
      gone = result.current.addCell("score");
    });
    const len = result.current.activeLesson!.cells.length;
    const idx = result.current.activeLesson!.cells.findIndex((c) => c.id === gone);

    let deleted: ReturnType<typeof result.current.deleteCell> = null;
    act(() => {
      deleted = result.current.deleteCell(gone);
    });
    expect(result.current.activeLesson!.cells.find((c) => c.id === gone)).toBeUndefined();
    expect(deleted!.cell.id).toBe(gone);
    expect(deleted!.index).toBe(idx);

    act(() => result.current.restoreCell(deleted!));
    const cells = result.current.activeLesson!.cells;
    expect(cells).toHaveLength(len);
    expect(cells[idx].id).toBe(gone);
    expect(cells.some((c) => c.id === keep)).toBe(true);
  });

  it("createLesson adds a new active Lesson at the front of the order", async () => {
    const { result } = await mountStore();
    const orderLen = result.current.state.order.length;
    act(() => result.current.createLesson());
    expect(result.current.state.order).toHaveLength(orderLen + 1);
    expect(result.current.state.activeId).toBe(result.current.state.order[0]);
    expect(result.current.activeLesson?.cells).toHaveLength(0);
  });

  it("deleteLesson returns the removed lesson and restoreLesson puts it back active at its slot", async () => {
    const { result } = await mountStore();
    act(() => result.current.createLesson()); // a second lesson, now active at order[0]
    const removedId = result.current.activeLesson!.id;
    const orderBefore = [...result.current.state.order];

    let deleted: ReturnType<typeof result.current.deleteLesson> = null;
    act(() => {
      deleted = result.current.deleteLesson(removedId);
    });
    expect(result.current.state.lessons[removedId]).toBeUndefined();
    expect(result.current.state.order).not.toContain(removedId);
    expect(deleted!.lesson.id).toBe(removedId);
    expect(deleted!.wasActive).toBe(true);
    expect(deleted!.index).toBe(orderBefore.indexOf(removedId));

    act(() => result.current.restoreLesson(deleted!));
    expect(result.current.state.lessons[removedId]).toBeDefined();
    expect(result.current.state.order).toEqual(orderBefore); // restored at its original slot
    expect(result.current.state.activeId).toBe(removedId); // and re-activated
  });

  it("importLesson adds the parsed Lesson with a fresh id and makes it active", async () => {
    const { result } = await mountStore();
    const orderLen = result.current.state.order.length;
    act(() =>
      result.current.importLesson({
        cells: [{ id: "old", kind: "note", source: "imported" }],
      }),
    );
    expect(result.current.state.order).toHaveLength(orderLen + 1);
    const cells = result.current.activeLesson!.cells;
    expect(cells).toHaveLength(1);
    expect(noteSourceOf(cells, cells[0].id)).toBe("imported");
  });

  it("togglePin flips a lesson's pinned flag without bumping updated", async () => {
    const { result } = await mountStore();
    const id = result.current.activeLesson!.id;
    const updatedBefore = result.current.state.lessons[id].updated;
    act(() => result.current.togglePin(id));
    expect(result.current.state.lessons[id].pinned).toBe(true);
    act(() => result.current.togglePin(id));
    expect(result.current.state.lessons[id].pinned).toBe(false);
    // Organizing isn't editing — the recency timestamp must be untouched (ADR-0005).
    expect(result.current.state.lessons[id].updated).toBe(updatedBefore);
  });

  it("setLessonTags normalizes the tags and leaves updated untouched", async () => {
    const { result } = await mountStore();
    const id = result.current.activeLesson!.id;
    const updatedBefore = result.current.state.lessons[id].updated;
    act(() => result.current.setLessonTags(id, ["Bach", "bach ", "  Scales"]));
    expect(result.current.state.lessons[id].tags).toEqual(["bach", "scales"]);
    expect(result.current.state.lessons[id].updated).toBe(updatedBefore);
  });

  it("importLesson normalizes incoming tags", async () => {
    const { result } = await mountStore();
    act(() =>
      result.current.importLesson({
        cells: [{ id: "c", kind: "note", source: "x" }],
        tags: ["B", "b", " a "],
      }),
    );
    expect(result.current.activeLesson!.tags).toEqual(["a", "b"]);
  });

  it("importLesson rejects a file with no cells", async () => {
    const { result } = await mountStore();
    expect(() => act(() => result.current.importLesson({ nope: true }))).toThrow(
      /Keyboard Notes file/,
    );
  });

  // Export → import is the only backup/transfer bridge, so its fidelity is load-bearing. Build a
  // lesson, serialize it through JSON exactly as the exporter does ({ app, version, lesson }), then
  // re-import the parsed envelope and assert the cells survive byte-for-byte. A fresh lesson id is
  // expected (import always mints one); cell ids and content must be preserved.
  it("round-trips a lesson's cells through export-serialize → import", async () => {
    const { result } = await mountStore();
    let noteId = "";
    let scoreId = "";
    act(() => {
      noteId = result.current.addCell("note");
    });
    act(() => result.current.updateCell(noteId, { source: "# Practice\n- [ ] scales" }));
    act(() => {
      scoreId = result.current.addCell("score");
    });

    const original = result.current.activeLesson!;
    const originalCells = original.cells;
    // Serialize through the real exporter Topbar uses — JSON is the lossy step we're guarding.
    const parsed = JSON.parse(serializeLesson(original));

    act(() => result.current.importLesson(parsed));

    const imported = result.current.activeLesson!;
    expect(imported.id).not.toBe(original.id); // a fresh id is minted on import
    expect(imported.cells).toEqual(originalCells); // …but cells round-trip unchanged
    expect(imported.cells.map((c) => c.id)).toEqual([noteId, scoreId]);
  });
});
