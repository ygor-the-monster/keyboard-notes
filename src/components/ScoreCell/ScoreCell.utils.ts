// ABC header/body handling + textarea insertion for the music editor.

// abcjs is large, so it's loaded lazily (kept out of the initial bundle) and cached after the
// first load. abcjs ships no usable types, so it's the `any` seam here; ScoreCell calls
// getAbcjs() on mount, so the instance is ready by the time the smart-note editor runs.
let _abcjs: any = null;
export async function getAbcjs(): Promise<any> {
  if (_abcjs) return _abcjs;
  const m = await import("abcjs");
  _abcjs = (m as any).default ?? m;
  return _abcjs;
}

// SMuFL codepoints (rendered in the Leland font) for notation glyph faces.
const G = (h: string) => String.fromCharCode(parseInt(h, 16));
export const SMUFL = {
  sharp: G("E262"),
  flat: G("E260"),
  natural: G("E261"),
  staccato: G("E4A2"),
  accent: G("E4A0"),
  tenuto: G("E4A4"),
  marcato: G("E4AC"),
  fermata: G("E4C0"),
  trill: G("E566"),
  mordent: G("E56C"),
  mordentLower: G("E56D"),
  turn: G("E567"),
  turnInverted: G("E568"),
  dynP: G("E520"),
  dynPP: G("E52B"),
  dynPPP: G("E52A"),
  dynMP: G("E52C"),
  dynMF: G("E52D"),
  dynF: G("E522"),
  dynFF: G("E52F"),
  dynFFF: G("E530"),
  dynS: G("E524"),
  dynZ: G("E525"),
  cresc: G("E53E"),
  dim: G("E53F"),
  restQuarter: G("E4E5"),
  restDoubleWhole: G("E4E2"),
  grace: G("E562"),
  acciaccatura: G("E560"),
};

interface AbcParts {
  header: string;
  body: string;
}

// Split an ABC tune into its header (info fields + %%score + V: definitions, up to and including
// the K: line) and the music body (the [V:id] lines after it).
export function splitAbc(source: string): AbcParts {
  const lines = (source || "").split("\n");
  const k = lines.findIndex((l) => /^\s*K:/.test(l));
  if (k === -1) return { header: source || "", body: "" };
  return { header: lines.slice(0, k + 1).join("\n"), body: lines.slice(k + 1).join("\n") };
}

// Recombine an edited header + body back into a single ABC source (lossless join).
export function joinAbc(header: string, body: string): string {
  if (!header) return body;
  if (!body) return header;
  return header + "\n" + body;
}

// Distinct voice (staff) ids declared across the header (V: defs) and body ([V:id] lines).
export function staffIds(header: string, body = ""): string[] {
  const ids: string[] = [];
  for (const l of (header + "\n" + body).split("\n")) {
    const m = l.match(/^\s*\[?V:\s*([^\s\]]+)/);
    if (m && !ids.includes(m[1])) ids.push(m[1]);
  }
  return ids;
}

// Add a new voice (staff) with the given clef. Returns the updated { header, body }.
export function addStaff(header: string, body: string, clef = "treble"): AbcParts {
  const ids = staffIds(header, body);
  let n = 1;
  while (ids.includes("V" + n)) n++;
  const id = "V" + n;

  const hl = (header || "").split("\n").map((l) => {
    if (/^\s*%%(score|staves)\b/.test(l)) {
      return /[}\]]\s*$/.test(l) ? l.replace(/\s*([}\]])\s*$/, ` (${id}) $1`) : `${l} (${id})`;
    }
    return l;
  });
  const defLine = `V:${id} clef=${clef}`;
  const kIdx = hl.findIndex((l) => /^\s*K:/.test(l));
  if (kIdx >= 0) hl.splice(kIdx, 0, defLine);
  else hl.push(defLine);

  const newBody = (body && body.trim() ? body.replace(/\s*$/, "") + "\n" : "") + `[V:${id}] z4 |`;
  return { header: hl.join("\n"), body: newBody };
}

// Remove a staff (voice) — defaults to the last one. Keeps at least one staff.
export function removeStaff(header: string, body: string, staffId?: string): AbcParts {
  const ids = staffIds(header, body);
  if (ids.length <= 1) return { header, body };
  const target = staffId && ids.includes(staffId) ? staffId : ids[ids.length - 1];
  const isTargetStaff = (l: string) => {
    const m = l.match(/^\s*\[?V:\s*([^\s\]]+)/);
    return m && m[1] === target;
  };
  const stripScore = (l: string) =>
    /^\s*%%(score|staves)\b/.test(l)
      ? l
          .replace(new RegExp(`\\(\\s*${target}\\s*\\)`, "g"), "")
          .replace(/\s{2,}/g, " ")
          .replace(/\s+([}\]])/g, " $1")
          .trimEnd()
      : l;
  const newHeader = (header || "")
    .split("\n")
    .filter((l) => !isTargetStaff(l))
    .map(stripScore)
    .join("\n");
  const newBody = (body || "")
    .split("\n")
    .filter((l) => !isTargetStaff(l))
    .join("\n");
  return { header: newHeader, body: newBody };
}

// --- Smart, caret/selection-aware note editing (via abcjs.parseOnly) -----------------
// A note token is [accidentals][letter][octave marks][length].
const NOTE_RE = /^([_^=]*)([A-Ga-g])([',]*)(.*)$/;

interface BodyNote {
  start: number;
  end: number;
  rest: boolean;
}

// Every note element's char span, mapped back to offsets into `body`.
function bodyNotes(header: string, body: string): BodyNote[] {
  const hdrLen = header ? header.length + 1 : 0;
  if (!_abcjs) return []; // abcjs not loaded yet → caller falls back to a plain insert
  let tunes: any;
  try {
    tunes = _abcjs.parseOnly(joinAbc(header, body));
  } catch {
    return [];
  }
  const notes: BodyNote[] = [];
  for (const tune of tunes)
    for (const line of tune.lines || [])
      for (const st of line.staff || [])
        for (const voice of st.voices || [])
          for (const el of voice)
            if (el.el_type === "note" && typeof el.startChar === "number")
              notes.push({
                start: el.startChar - hdrLen,
                end: el.endChar - hdrLen,
                rest: !!el.rest,
              });
  return notes.filter((n) => n.start >= 0).sort((a, b) => a.start - b.start);
}

// The note(s) a tool should act on: those overlapping a selection, else the one at/just before
// the caret.
function targetNotes(header: string, body: string, selStart: number, selEnd: number): BodyNote[] {
  const notes = bodyNotes(header, body);
  if (!notes.length) return [];
  if (selEnd > selStart) return notes.filter((n) => n.start < selEnd && n.end > selStart);
  let hit = notes.find((n) => selStart >= n.start && selStart < n.end);
  if (!hit) {
    const before = notes.filter((n) => n.end <= selStart);
    hit = before.length ? before[before.length - 1] : undefined;
  }
  return hit ? [hit] : [];
}

// Octave shift / accidental set / length set on the targeted note(s). Returns the new body, or
// null when no note is found (caller falls back to a plain insert at the caret).
export function smartNote(
  header: string,
  body: string,
  selStart: number,
  selEnd: number,
  kind: string,
  arg?: any,
): string | null {
  const targets = targetNotes(header, body, selStart, selEnd).filter((t) => !t.rest);
  if (!targets.length) return null;
  let b = body;
  for (const t of [...targets].sort((a, c) => c.start - a.start)) {
    const raw = b.slice(t.start, t.end);
    const lead = (raw.match(/^\s*/) || [""])[0];
    const mid = raw.slice(lead.length).replace(/\s+$/, "");
    const trail = raw.slice(lead.length + mid.length);
    const m = mid.match(NOTE_RE);
    if (!m) continue;
    let [, acc, letter, oct, len] = m;
    if (kind === "octave")
      oct =
        arg > 0
          ? oct.includes(",")
            ? oct.replace(",", "")
            : oct + "'"
          : oct.includes("'")
            ? oct.replace("'", "")
            : oct + ",";
    else if (kind === "accidental") acc = arg;
    else if (kind === "length") len = arg;
    b = b.slice(0, t.start) + lead + acc + letter + oct + len + trail + b.slice(t.end);
  }
  return b;
}

// Wrap the targeted note range as a chord [CEG] or a slur ( … ). Returns the new body, or null.
export function wrapNotes(
  header: string,
  body: string,
  selStart: number,
  selEnd: number,
  kind: string,
): string | null {
  const targets = targetNotes(header, body, selStart, selEnd);
  if (!targets.length) return null;
  let from = Math.min(...targets.map((t) => t.start));
  const to = Math.max(...targets.map((t) => t.end));
  while (from < to && /\s/.test(body[from])) from++; // skip the separator space
  const inner = body.slice(from, to).replace(/\s+$/, "");
  const trail = body.slice(from + inner.length, to);
  const wrapped = kind === "chord" ? "[" + inner.replace(/\s+/g, "") + "]" : "(" + inner + ")";
  return body.slice(0, from) + wrapped + trail + body.slice(to);
}

// A blank line terminates a tune in ABC, so strip blank lines before rendering/playing.
export function cleanAbc(source: string): string {
  return (source || "")
    .split("\n")
    .filter((line) => line.trim() !== "")
    .join("\n");
}

// Read the tempo (BPM) from the header's Q: field. Handles "Q:1/4=120", "Q:120".
export function parseTempo(header: string, fallback = 90): number {
  const line = (header || "").match(/^\s*Q:(.*)$/m);
  if (!line) return fallback;
  const eq = line[1].match(/=\s*(\d+)/);
  if (eq) return Number(eq[1]);
  const num = line[1].match(/(\d+)\s*$/);
  return num ? Number(num[1]) : fallback;
}

// Set the tempo (Q:) in the header — replace an existing Q: line, else add one after K:.
export function withTempo(header: string, tempo: number): string {
  if (/^\s*Q:/m.test(header)) return header.replace(/^\s*Q:.*$/m, "Q:1/4=" + tempo);
  if (/^\s*K:.*$/m.test(header)) return header.replace(/^(\s*K:.*)$/m, "$1\nQ:1/4=" + tempo);
  return header + "\nQ:1/4=" + tempo;
}

// Insert text at the caret (replacing any selection) while preserving the browser's native undo
// stack via execCommand; `back` leaves the caret N chars from the end (paired tokens).
export function insertIntoTextarea(
  ta: HTMLTextAreaElement | null,
  text: string,
  back = 0,
  onValue?: (v: string) => void,
): void {
  if (!ta) return;
  ta.focus();
  const inserted = document.execCommand && document.execCommand("insertText", false, text);
  if (!inserted) {
    ta.setRangeText(text, ta.selectionStart, ta.selectionEnd, "end");
    onValue?.(ta.value);
  }
  if (back) {
    const p = ta.selectionStart - back;
    ta.setSelectionRange(p, p);
  }
}
