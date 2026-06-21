import { useEffect, useState } from "react";
import { getPref, setPref } from "../providers/StoreProvider/StoreProvider.utils.ts";

// Concert-pitch reference (A4 in Hz), shared *live* across the Tuner and Drone so they can never
// disagree. A module-level value + listener set keeps every mounted consumer in sync within the tab
// (plain usePref wouldn't — each component would hold its own stale copy); persisted to localStorage
// so it survives reloads.
const KEY = "ref.a4";
let current = getPref<number>(KEY, 440);
const listeners = new Set<(v: number) => void>();

export function useRefPitch(): [number, (v: number) => void] {
  const [a4, setLocal] = useState(current);
  useEffect(() => {
    listeners.add(setLocal);
    setLocal(current); // catch any change made before this consumer mounted
    return () => {
      listeners.delete(setLocal);
    };
  }, []);
  const set = (v: number) => {
    current = v;
    setPref(KEY, v);
    listeners.forEach((l) => l(v));
  };
  return [a4, set];
}
