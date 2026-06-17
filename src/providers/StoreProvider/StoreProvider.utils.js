// Persistence layer. Heavy data (notebooks + embedded media) lives in IndexedDB —
// localStorage's ~5 MB quota was easily exceeded once images / PDFs / audio are embedded as
// data URLs; IndexedDB has far more room and stores structured objects directly (no JSON
// stringify). The whole app state is one record; loadState transparently migrates old
// localStorage data. Lightweight UI preferences (theme, metronome tempo, …) stay in
// localStorage via the small usePref hook at the bottom of this file.
import { useCallback, useState } from "react";

// Default content for a new music cell — stored pre-split into header / body fields.
// Score setup (%%score + V: clef definitions) lives in the header, before K:; the body
// holds only the per-voice music lines.
const DEFAULT_MUSIC_HEADER =
  "X:1\nM:4/4\nL:1/4\nQ:1/4=90\n%%score { (RH) (LH) }\nV:RH clef=treble\nV:LH clef=bass\nK:C";

const STORE_KEY = "pianoNotes.v2"; // legacy localStorage key (migrated from, then cleared)
const DB_NAME = "pianoNotes";
const DB_STORE = "kv";
const STATE_KEY = "state";
const EMPTY_STATE = { notebooks: {}, order: [], activeId: null };

export const uid = () =>
  "id-" + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);

// --- Minimal promise-based IndexedDB key/value store (no dependency) -----------------
let dbPromise = null;
function openDb() {
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
async function idbGet(key) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const r = db.transaction(DB_STORE, "readonly").objectStore(DB_STORE).get(key);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
async function idbSet(key, value) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, "readwrite");
    tx.objectStore(DB_STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadState() {
  try {
    const fromIdb = await idbGet(STATE_KEY);
    if (fromIdb) return fromIdb;
  } catch (e) {
    console.warn("IndexedDB read failed:", e);
  }
  // One-time migration of any data still held in the old localStorage store.
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
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

let saveTimer = null;
let pendingState = null;
function writeNow() {
  if (pendingState == null) return;
  const s = pendingState;
  pendingState = null;
  clearTimeout(saveTimer);
  saveTimer = null;
  idbSet(STATE_KEY, s).catch((e) => {
    console.error("Saving failed:", e);
    alert("Saving failed — storage may be full or unavailable. Export a backup (JSON).");
  });
}
export function saveState(state) {
  pendingState = state;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(writeNow, 250);
}
// Write any pending (debounced) save immediately — call when the tab is being hidden so the
// last edit isn't lost in the debounce window.
export function flushState() {
  if (saveTimer) writeNow();
}

// Ask the browser to make storage durable so lessons aren't evicted under storage pressure.
export async function requestPersistentStorage() {
  try {
    if (navigator.storage?.persisted && (await navigator.storage.persisted())) return true;
    return (await navigator.storage?.persist?.()) ?? false;
  } catch {
    return false;
  }
}

export async function storageEstimate() {
  try {
    const { usage, quota } = (await navigator.storage?.estimate?.()) || {};
    const persisted = (await navigator.storage?.persisted?.()) ?? false;
    return { usage, quota, persisted };
  } catch {
    return {};
  }
}

// ---- Cell + notebook factories ----
export function newMarkdownCell(text) {
  // A fresh note starts empty (so it shows its empty state); callers that want starter
  // content pass `text` explicitly (e.g. the first cell of a new notebook).
  return {
    id: uid(),
    type: "md",
    source: text != null ? text : "",
    edit: true,
  };
}

export function newMusicCell() {
  // Header (X:/M:/L:/Q:/K: …) and music body are stored separately, joined at render time.
  // Body starts empty so a fresh score shows its empty state; the header keeps the score
  // setup ready for when the user starts writing notes.
  return {
    id: uid(),
    type: "abc",
    header: DEFAULT_MUSIC_HEADER,
    body: "",
    edit: true,
  };
}

// Non-destructive image edits: the original `dataUrl` is never overwritten after upload.
// Crop / rotate / flip / colour adjustments are stored as reversible parameters and pen
// marks as vector `strokes`, both applied at render time.
export const DEFAULT_IMAGE_EDITS = {
  rotate: 0, // 0 | 90 | 180 | 270 (clockwise degrees)
  flipH: false,
  flipV: false,
  crop: null, // { x, y, w, h } normalised over the flipped+rotated image, or null
  bright: 0, // integer steps, applied as a CSS filter multiplier
  contrast: 0,
  sat: 0,
};

export function newImageCell() {
  return {
    id: uid(),
    type: "img",
    dataUrl: "",
    edits: { ...DEFAULT_IMAGE_EDITS },
    strokes: [],
    edit: true,
  };
}

export function newPdfCell() {
  return {
    id: uid(),
    type: "pdf",
    dataUrl: "",
    url: "",
    name: "",
    height: 480,
    annotations: {}, // { [pageNumber]: stroke[] } — non-destructive overlay
    edit: true,
  };
}

export function newAudioCell() {
  return { id: uid(), type: "snd", dataUrl: "", marks: [], edit: true };
}

export function newCifraCell() {
  return {
    id: uid(),
    type: "cifra",
    // ChordPro-style: chords in [brackets] inline with lyrics, blank lines split sections,
    // a line wrapped in {curly braces} is a section heading. Starts empty — the example
    // lives in the editor placeholder (cifra.placeholder), like note & score cells.
    source: "",
    transpose: 0, // semitone offset applied non-destructively at render
    edit: true,
  };
}

export function newNotebook() {
  const t = Date.now();
  return {
    id: uid(),
    title: "",
    created: t,
    updated: t,
    cells: [newMarkdownCell("# Lesson\n\n_Date, goals, pieces…_"), newMusicCell()],
  };
}

// ---- Lightweight UI preferences (localStorage) ------------------------------------
// Small, frequently-read values like the theme, metronome tempo, or drone note. Never put
// large blobs here — that's what the IndexedDB store above is for.
const PREF_NS = "pianoNotes.pref.";

export function getPref(key, fallback) {
  try {
    const raw = localStorage.getItem(PREF_NS + key);
    return raw != null ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export function setPref(key, value) {
  try {
    localStorage.setItem(PREF_NS + key, JSON.stringify(value));
  } catch (e) {
    console.warn("Could not save preference:", e);
  }
}

// useState that mirrors to localStorage. Same API as useState (supports updater fns).
export function usePref(key, fallback) {
  const [value, setValue] = useState(() => getPref(key, fallback));
  const set = useCallback(
    (next) =>
      setValue((prev) => {
        const v = typeof next === "function" ? next(prev) : next;
        setPref(key, v);
        return v;
      }),
    [key],
  );
  return [value, set];
}
