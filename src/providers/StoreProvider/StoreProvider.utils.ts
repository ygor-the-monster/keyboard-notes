// Persistence layer. Heavy data (Lessons + embedded media) lives in IndexedDB — localStorage's
// ~5 MB quota was easily exceeded once images / PDFs / audio are embedded as data URLs. The
// whole app state is one record; loadState transparently migrates old localStorage data.
// Lightweight UI preferences (theme, metronome tempo, …) stay in localStorage via usePref below.
// Cell/Lesson factories live in src/cells/kinds.ts — this file is persistence only.
import { useCallback, useState } from "react";
import type { AppState } from "../../cells/kinds.ts";

const STORE_KEY = "pianoNotes.v2"; // legacy localStorage key (migrated from, then cleared)
const DB_NAME = "pianoNotes";
const DB_STORE = "kv";
const STATE_KEY = "state";
const EMPTY_STATE: AppState = { lessons: {}, order: [], activeId: null };

// --- Minimal promise-based IndexedDB key/value store (no dependency) -----------------
let dbPromise: Promise<IDBDatabase> | null = null;
function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") return reject(new Error("IndexedDB unavailable"));
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(DB_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}
async function idbGet(key: string): Promise<unknown> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const r = db.transaction(DB_STORE, "readonly").objectStore(DB_STORE).get(key);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
async function idbSet(key: string, value: unknown): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, "readwrite");
    tx.objectStore(DB_STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadState(): Promise<AppState> {
  try {
    const fromIdb = await idbGet(STATE_KEY);
    if (fromIdb) return fromIdb as AppState;
  } catch (e) {
    console.warn("IndexedDB read failed:", e);
  }
  // One-time migration of any data still held in the old localStorage store.
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AppState;
      try {
        await idbSet(STATE_KEY, parsed);
        localStorage.removeItem(STORE_KEY); // free the localStorage quota once migrated
      } catch (e) {
        console.warn("Migration to IndexedDB failed (keeping localStorage copy):", e);
      }
      return parsed;
    }
  } catch (e) {
    console.warn("Could not read saved notes:", e);
  }
  return { ...EMPTY_STATE };
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;
let pendingState: AppState | null = null;
function writeNow(): void {
  if (pendingState == null) return;
  const s = pendingState;
  pendingState = null;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = null;
  idbSet(STATE_KEY, s).catch((e) => {
    console.error("Saving failed:", e);
    alert("Saving failed — storage may be full or unavailable. Export a backup (JSON).");
  });
}
export function saveState(state: AppState): void {
  pendingState = state;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(writeNow, 250);
}
// Write any pending (debounced) save immediately — call when the tab is being hidden so the
// last edit isn't lost in the debounce window.
export function flushState(): void {
  if (saveTimer) writeNow();
}

// Ask the browser to make storage durable so Lessons aren't evicted under storage pressure.
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (navigator.storage?.persisted && (await navigator.storage.persisted())) return true;
    return (await navigator.storage?.persist?.()) ?? false;
  } catch {
    return false;
  }
}

export interface StorageEstimateResult {
  usage?: number;
  quota?: number;
  persisted?: boolean;
}
export async function storageEstimate(): Promise<StorageEstimateResult> {
  try {
    const { usage, quota } = (await navigator.storage?.estimate?.()) || {};
    const persisted = (await navigator.storage?.persisted?.()) ?? false;
    return { usage, quota, persisted };
  } catch {
    return {};
  }
}

// ---- Lightweight UI preferences (localStorage) ------------------------------------
// Small, frequently-read values like the theme, metronome tempo, or drone note. Never put
// large blobs here — that's what the IndexedDB store above is for.
const PREF_NS = "pianoNotes.pref.";

export function getPref<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREF_NS + key);
    return raw != null ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function setPref(key: string, value: unknown): void {
  try {
    localStorage.setItem(PREF_NS + key, JSON.stringify(value));
  } catch (e) {
    console.warn("Could not save preference:", e);
  }
}

// useState that mirrors to localStorage. Same API as useState (supports updater fns).
export function usePref<T>(key: string, fallback: T): [T, (next: T | ((prev: T) => T)) => void] {
  const [value, setValue] = useState<T>(() => getPref(key, fallback));
  const set = useCallback(
    (next: T | ((prev: T) => T)) =>
      setValue((prev) => {
        const v = typeof next === "function" ? (next as (p: T) => T)(prev) : next;
        setPref(key, v);
        return v;
      }),
    [key],
  );
  return [value, set];
}
