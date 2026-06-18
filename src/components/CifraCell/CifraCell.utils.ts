// Chord-chart (cifra) parsing + transposition.
//
// Source is ChordPro-ish:
//   • inline chords in [brackets]:  "[C]Twinkle [G]little [C]star"
//   • a whole line wrapped in {curly braces} is a section heading: "{Chorus}"
//   • any other line is rendered literally (so a hand-aligned chord line typed above a
//     lyric line still works in the monospace layout — it just isn't transposed).
// Only bracketed chords are parsed into chord/lyric columns and transposed.

export interface CifraSeg {
  chord: string;
  text: string;
}
export type CifraBlock =
  | { type: "heading"; text: string }
  | { type: "blank" }
  | { type: "plain"; text: string }
  | { type: "line"; lead: string; segs: CifraSeg[] };

const SHARP = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const FLAT = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
const NOTE_IDX: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

function shiftNote(note: string, semis: number, preferFlat: boolean): string {
  const m = /^([A-G])([#b]?)/.exec(note);
  if (!m) return note;
  let idx = NOTE_IDX[m[1]] + (m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0);
  idx = (((idx + semis) % 12) + 12) % 12;
  return (preferFlat ? FLAT : SHARP)[idx];
}

// Transpose a single chord symbol (e.g. "Bbm7", "F#", "C/G") by `semis` semitones, preserving
// quality/extensions and the optional bass note. Enharmonic spelling follows the original root's
// accidental (a flat chord stays flat-spelled).
export function transposeChord(sym: string, semis: number): string {
  if (!semis) return sym;
  const [main, bass] = sym.split("/");
  const m = /^([A-G])([#b]?)(.*)$/.exec(main.trim());
  if (!m) return sym; // not a recognisable chord — leave as typed
  const preferFlat = m[2] === "b";
  const root = shiftNote(m[1] + m[2], semis, preferFlat);
  let out = root + m[3];
  if (bass != null) {
    const bm = /^([A-G])([#b]?)(.*)$/.exec(bass.trim());
    out += "/" + (bm ? shiftNote(bm[1] + bm[2], semis, bm[2] === "b") + bm[3] : bass);
  }
  return out;
}

// A whitespace-separated token that looks like a chord symbol: root note + optional accidental,
// then only chord-ish characters (qualities, extensions, slash bass). Kept strict enough that
// ordinary lyric words ("Drawing", "without") fail.
const CHORD_TOKEN =
  /^[A-G][#b]?(?:m|maj|min|dim|aug|sus|add|M|°|ø|[0-9#b+()])*(?:\/[A-G][#b]?(?:m|maj|min|dim|aug|sus|add|M|°|ø|[0-9#b+()])*)?$/;

// True when every token on the line is chord-shaped — i.e. it's a chord row, not lyrics.
function isChordLine(line: string): boolean {
  const toks = line.trim().split(/\s+/);
  return toks.length > 0 && toks.every((t) => CHORD_TOKEN.test(t));
}

// Re-transpose the chords on a standalone chord row (no lyric line beneath it).
function transposeChordLine(line: string, semis: number): string {
  return semis ? line.replace(/\S+/g, (t) => transposeChord(t, semis)) : line;
}

// Pair a chord row with the lyric line beneath it, aligning each chord to the column it sits over
// (how chord charts are laid out in PDFs). Produces the same { lead, segs } shape as the bracket
// parser, so it renders aligned regardless of font — and chords get transposed.
function alignChordLyric(
  chordLine: string,
  lyricLine: string,
  semis: number,
): { lead: string; segs: CifraSeg[] } {
  const cols: { at: number; chord: string }[] = [];
  const re = /\S+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(chordLine))) cols.push({ at: m.index, chord: m[0] });
  if (!cols.length) return { lead: lyricLine, segs: [] };
  const lead = cols[0].at > 0 ? lyricLine.slice(0, cols[0].at) : "";
  const segs = cols.map((c, i) => {
    const end = i + 1 < cols.length ? cols[i + 1].at : lyricLine.length;
    return {
      chord: transposeChord(c.chord, semis),
      text: lyricLine.slice(c.at, Math.max(c.at, end)),
    };
  });
  return { lead, segs };
}

// Split one lyric line into [{ chord, text }] segments. A leading text run (before the first
// chord) yields { chord: "", text }.
function parseLyricLine(line: string, semis: number): { lead: string; segs: CifraSeg[] } {
  const segs: CifraSeg[] = [];
  const re = /\[([^\]]*)\]/g;
  let last = 0;
  let pending = ""; // chord waiting for its text
  let lead = "";
  let m: RegExpExecArray | null;
  let seenChord = false;
  while ((m = re.exec(line))) {
    const text = line.slice(last, m.index);
    if (!seenChord) lead = text;
    else segs.push({ chord: pending, text });
    pending = transposeChord(m[1], semis);
    last = re.lastIndex;
    seenChord = true;
  }
  const tail = line.slice(last);
  if (seenChord) segs.push({ chord: pending, text: tail });
  return { lead, segs };
}

// Parse the whole source into renderable blocks for the chart view.
export function parseCifra(source: string, semis = 0): CifraBlock[] {
  const lines = (source || "").split("\n").map((raw) => raw.replace(/\s+$/, ""));
  const out: CifraBlock[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) {
      out.push({ type: "blank" });
      continue;
    }
    const heading = /^\{(.+)\}$/.exec(line.trim());
    if (heading) {
      out.push({ type: "heading", text: heading[1].trim() });
      continue;
    }
    if (line.includes("[")) {
      out.push({ type: "line", ...parseLyricLine(line, semis) });
      continue;
    }
    // A chord row: if a lyric line follows, align the two; otherwise it's a standalone
    // (instrumental) chord row — keep it literal but still transpose it.
    if (isChordLine(line)) {
      const next = lines[i + 1];
      const nextIsLyric =
        next != null &&
        next.trim() &&
        !/^\{(.+)\}$/.test(next.trim()) &&
        !next.includes("[") &&
        !isChordLine(next);
      if (nextIsLyric) {
        out.push({ type: "line", ...alignChordLyric(line, next, semis) });
        i++; // consume the paired lyric line
      } else {
        out.push({ type: "plain", text: transposeChordLine(line, semis) });
      }
      continue;
    }
    out.push({ type: "plain", text: line });
  }
  return out;
}

// Human label for the current transpose offset, e.g. "+2" / "−3" / "0".
export function transposeLabel(semis: number): string {
  if (!semis) return "0";
  return (semis > 0 ? "+" : "−") + Math.abs(semis);
}
