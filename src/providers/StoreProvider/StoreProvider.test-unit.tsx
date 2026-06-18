import { describe, it, expect } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { StoreProvider, useStore } from "./StoreProvider.tsx";
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

  it("deleteCell removes the cell and undoDelete restores it at its index", async () => {
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

    act(() => result.current.deleteCell(gone));
    expect(result.current.activeLesson!.cells.find((c) => c.id === gone)).toBeUndefined();
    expect(result.current.lastDeleted?.cell.id).toBe(gone);

    act(() => result.current.undoDelete());
    const cells = result.current.activeLesson!.cells;
    expect(cells).toHaveLength(len);
    expect(cells[idx].id).toBe(gone);
    expect(cells.some((c) => c.id === keep)).toBe(true);
    expect(result.current.lastDeleted).toBeNull();
  });

  it("createLesson adds a new active Lesson at the front of the order", async () => {
    const { result } = await mountStore();
    const orderLen = result.current.state.order.length;
    act(() => result.current.createLesson());
    expect(result.current.state.order).toHaveLength(orderLen + 1);
    expect(result.current.state.activeId).toBe(result.current.state.order[0]);
    expect(result.current.activeLesson?.cells).toHaveLength(0);
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

  it("importLesson rejects a file with no cells", async () => {
    const { result } = await mountStore();
    expect(() => act(() => result.current.importLesson({ nope: true }))).toThrow(
      /Piano Notes file/,
    );
  });
});
