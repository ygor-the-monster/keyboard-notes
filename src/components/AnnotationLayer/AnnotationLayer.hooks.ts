import { useEffect, useState } from "react";
import type { AnnotationStroke } from "../../cells/kinds.ts";

type Strokes = AnnotationStroke[];

// Transient undo/redo history for an Annotation. The committed strokes stay controlled by the
// caller (and persisted in the cell); only the past/future stacks live here, and they are never
// saved. Both the Image and PDF cells share this — undo/redo logic lives in one place.
//
// `resetKey` clears history when the target changes (the PDF cell passes the page number, so
// switching pages starts a fresh stack).
export function useStrokeHistory(
  strokes: Strokes,
  setStrokes: (next: Strokes) => void,
  resetKey?: unknown,
) {
  const [past, setPast] = useState<Strokes[]>([]);
  const [future, setFuture] = useState<Strokes[]>([]);

  useEffect(() => {
    setPast([]);
    setFuture([]);
  }, [resetKey]);

  // A new committed change (stroke drawn or erased): remember the prior strokes, drop the redo
  // branch, then persist the new strokes.
  const commit = (next: Strokes) => {
    setPast([...past, strokes]);
    setFuture([]);
    setStrokes(next);
  };

  const undo = () => {
    if (!past.length) return;
    setPast(past.slice(0, -1));
    setFuture([strokes, ...future]);
    setStrokes(past[past.length - 1]);
  };

  const redo = () => {
    if (!future.length) return;
    setPast([...past, strokes]);
    setFuture(future.slice(1));
    setStrokes(future[0]);
  };

  const clear = () => {
    if (!strokes.length) return;
    commit([]);
  };

  return {
    commit,
    undo,
    redo,
    clear,
    canUndo: past.length > 0,
    canRedo: future.length > 0,
    canClear: strokes.length > 0,
  };
}
