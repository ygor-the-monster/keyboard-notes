import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useStrokeHistory } from "./AnnotationLayer.hooks.ts";
import type { AnnotationStroke } from "../../cells/kinds.ts";

const stroke = (n: number): AnnotationStroke => ({
  color: "#000",
  width: 0.01,
  opacity: 1,
  points: [[n, n]],
});

describe("useStrokeHistory", () => {
  it("commit → undo → redo round-trips the controlled strokes", () => {
    // The strokes are controlled (owned by the caller); thread them back on each rerender,
    // the way the cell re-renders with the persisted strokes.
    let strokes: AnnotationStroke[] = [];
    const setStrokes = (next: AnnotationStroke[]) => {
      strokes = next;
    };
    const { result, rerender } = renderHook(({ s }) => useStrokeHistory(s, setStrokes), {
      initialProps: { s: strokes },
    });

    expect(result.current.canUndo).toBe(false);
    expect(result.current.canClear).toBe(false);

    act(() => result.current.commit([stroke(1)]));
    expect(strokes).toEqual([stroke(1)]);
    rerender({ s: strokes });
    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(false);

    act(() => result.current.undo());
    expect(strokes).toEqual([]);
    rerender({ s: strokes });
    expect(result.current.canRedo).toBe(true);

    act(() => result.current.redo());
    expect(strokes).toEqual([stroke(1)]);
  });

  it("a fresh commit clears the redo branch", () => {
    let strokes: AnnotationStroke[] = [];
    const setStrokes = (next: AnnotationStroke[]) => {
      strokes = next;
    };
    const { result, rerender } = renderHook(({ s }) => useStrokeHistory(s, setStrokes), {
      initialProps: { s: strokes },
    });

    act(() => result.current.commit([stroke(1)]));
    rerender({ s: strokes });
    act(() => result.current.undo());
    rerender({ s: strokes });
    expect(result.current.canRedo).toBe(true);

    act(() => result.current.commit([stroke(2)]));
    rerender({ s: strokes });
    expect(result.current.canRedo).toBe(false);
  });
});
