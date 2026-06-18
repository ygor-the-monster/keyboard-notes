import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import {
  loadState,
  saveState,
  flushState,
  requestPersistentStorage,
  storageEstimate,
  getPref,
  setPref,
  usePref,
} from "./StoreProvider.utils.ts";
import type { AppState } from "../../utils/cellKinds/cellKinds.ts";

// Persistence layer over IndexedDB (provided in jsdom by fake-indexeddb). The legacy-migration
// test runs first, while IndexedDB is still empty for this file's fresh environment.
const lesson = (id: string, title: string) => ({
  id,
  title,
  created: 1,
  updated: 1,
  cells: [],
});
const state = (id: string, title: string): AppState => ({
  lessons: { [id]: lesson(id, title) },
  order: [id],
  activeId: id,
});

const LEGACY_KEY = "pianoNotes.v2";

// loadState() doesn't await the in-flight save, so poll until the written record shows up.
async function loadUntilTitle(title: string): Promise<AppState> {
  for (let i = 0; i < 50; i++) {
    const s = await loadState();
    if (s.activeId && s.lessons[s.activeId]?.title === title) return s;
  }
  throw new Error(`state with title "${title}" never persisted`);
}

beforeEach(() => localStorage.clear());

describe("StoreProvider persistence", () => {
  it("migrates a legacy localStorage payload into IndexedDB on first load", async () => {
    // Runs first: IndexedDB has no STATE_KEY yet, so loadState falls back to localStorage.
    localStorage.setItem(LEGACY_KEY, JSON.stringify(state("leg", "Legacy")));
    const s = await loadState();
    expect(s.activeId).toBe("leg");
    expect(s.lessons.leg.title).toBe("Legacy");
    // The legacy key is cleared once copied into IndexedDB.
    expect(localStorage.getItem(LEGACY_KEY)).toBeNull();
  });

  it("round-trips state through IndexedDB (saveState + flushState → loadState)", async () => {
    saveState(state("rt", "RoundTrip"));
    flushState();
    const s = await loadUntilTitle("RoundTrip");
    expect(s.order).toEqual(["rt"]);
    expect(s.lessons.rt.title).toBe("RoundTrip");
  });

  it("flushState is a no-op when nothing is pending", () => {
    expect(() => flushState()).not.toThrow();
  });

  it("degrades gracefully when storage APIs are unavailable in jsdom", async () => {
    await expect(requestPersistentStorage()).resolves.toBe(false);
    await expect(storageEstimate()).resolves.toMatchObject({ persisted: false });
  });
});

describe("UI preferences (localStorage)", () => {
  it("setPref then getPref round-trips a JSON value", () => {
    setPref("tempo", 132);
    expect(getPref("tempo", 90)).toBe(132);
  });

  it("getPref returns the fallback for a missing or corrupt value", () => {
    expect(getPref("nope", "default")).toBe("default");
    localStorage.setItem("pianoNotes.pref.broken", "{not json");
    expect(getPref("broken", 7)).toBe(7);
  });

  it("usePref updates state and mirrors to localStorage", () => {
    const { result } = renderHook(() => usePref("drone", 0));
    expect(result.current[0]).toBe(0);
    act(() => result.current[1](5));
    expect(result.current[0]).toBe(5);
    expect(getPref("drone", 0)).toBe(5);
  });

  it("usePref supports updater functions", () => {
    const { result } = renderHook(() => usePref<number>("count", 1));
    act(() => result.current[1]((n) => n + 10));
    expect(result.current[0]).toBe(11);
  });
});
