// localStorage-backed persistence for notebooks.

// Default content for a new music cell — stored pre-split into header / body fields.
// Score setup (%%score + V: clef definitions) lives in the header, before K:; the body
// holds only the per-voice music lines.
const DEFAULT_MUSIC_HEADER =
  "X:1\nM:4/4\nL:1/4\nQ:1/4=90\n%%score { (RH) (LH) }\nV:RH clef=treble\nV:LH clef=bass\nK:C";
const DEFAULT_MUSIC_BODY = "[V:RH] C D E F | G A B c |\n[V:LH] C,2 G,2 | C,2 G,2 |";

const STORE_KEY = "pianoNotes.v2";

export const uid = () =>
  "id-" + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);

export function loadState() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.warn("Could not read saved notes:", e);
  }
  return { notebooks: {}, order: [], activeId: null };
}

let saveTimer = null;
export function saveState(state) {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(state));
    } catch (e) {
      console.error(e);
      alert("Saving failed — storage may be full. Export a backup (JSON) and remove large images.");
    }
  }, 250);
}

// ---- Cell + notebook factories ----
export function newMarkdownCell(text) {
  return {
    id: uid(),
    type: "md",
    source: text != null ? text : "## New note\n\nWrite lesson notes here…\n\n- [ ] Practice task",
    edit: true,
  };
}

export function newMusicCell() {
  // Header (X:/M:/L:/Q:/K: …) and music body are stored separately, joined at render time.
  return {
    id: uid(),
    type: "abc",
    header: DEFAULT_MUSIC_HEADER,
    body: DEFAULT_MUSIC_BODY,
    edit: true,
  };
}

export function newImageCell() {
  return { id: uid(), type: "img", dataUrl: "", edit: true };
}

export function newPdfCell() {
  return { id: uid(), type: "pdf", dataUrl: "", url: "", name: "", height: 480, edit: true };
}

export function newAudioCell() {
  return { id: uid(), type: "snd", dataUrl: "", edit: true };
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
