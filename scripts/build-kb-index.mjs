// Build the music-tutor retrieval index from several sources, embed every chunk with a small
// sentence-transformer (the SAME model the browser uses at query time), and write public/kb-index.json.
// The index is self-describing — it records the model, dimension, pooling, normalization, and the
// retrieval query prefix it was built with — so the runtime embeds queries with exactly these
// settings and the two halves can never silently drift apart.
//
// Sources (each is just a producer that emits { id, source, file, title, heading, text, embedText }):
//   1. Authored Markdown   — src/prompts/kb/*.md (original, project-licensed).
//   2. Open Music Theory   — vendored Markdown chapters (CC BY-SA 4.0), cleaned + chunked.
//   3. music-theory-data   — vendored YAML (CC BY-SA 4.0); a curated set of common scales + every
//                            chord quality, decoded from their semitone bitmask into prose.
//
// Runs in Node via @huggingface/transformers (the same dependency the app bundles), on CPU. Invoke
// with `npm run kb:index`, or let the "Regenerate KB Index" GitHub Action run it and commit output.
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import yaml from "js-yaml";

const __dirname = dirname(fileURLToPath(import.meta.url));
const KB_DIR = join(__dirname, "..", "src", "prompts", "kb");
const OMT_DIR = join(KB_DIR, "vendor", "open-music-theory");
const MTD_DIR = join(KB_DIR, "vendor", "music-theory-data", "EqualTemperament", "12-Tone");
const OUT = join(__dirname, "..", "public", "kb-index.json");

// Embedding configuration — the single source of truth, copied verbatim into the index header.
// bge-small-en-v1.5: 384-dim, CLS pooling, normalized; queries (not documents) get the prefix.
const EMBED = {
  model: "Xenova/bge-small-en-v1.5",
  dim: 384,
  pooling: "cls",
  normalize: true,
  queryPrefix: "Represent this sentence for searching relevant passages: ",
};

const slug = (s) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

// --- 1. Authored Markdown -----------------------------------------------------------------

// Parse leading `---\n...\n---` frontmatter into a flat string map; return the remaining body.
function parseFrontmatter(raw) {
  const m = raw.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!m) return { meta: {}, body: raw };
  const meta = {};
  for (const line of m[1].split("\n")) {
    const kv = line.match(/^(\w+):\s*(.*)$/);
    if (kv) meta[kv[1]] = kv[2].trim();
  }
  return { meta, body: raw.slice(m[0].length) };
}

// Split a body into chunks at each "## " heading, keeping the heading line. If `preambleTitle` is
// given, any content before the first heading becomes its own chunk under that title.
function chunkByHeading(body, preambleTitle) {
  const out = [];
  const firstH = body.search(/(^|\n)## /);
  if (preambleTitle && (firstH === -1 || body.slice(0, firstH).trim())) {
    const pre = (firstH === -1 ? body : body.slice(0, firstH)).trim();
    if (pre) out.push({ heading: preambleTitle, text: `## ${preambleTitle}\n${pre}` });
  }
  for (const part of body.split(/\n(?=## )/)) {
    const text = part.trim();
    if (!text.startsWith("## ")) continue;
    const nl = text.indexOf("\n");
    out.push({ heading: text.slice(3, nl === -1 ? undefined : nl).trim(), text });
  }
  return out;
}

function collectAuthored() {
  const files = readdirSync(KB_DIR)
    .filter((f) => f.endsWith(".md") && f !== "SOURCES.md")
    .sort();
  const records = [];
  for (const file of files) {
    const { meta, body } = parseFrontmatter(readFileSync(join(KB_DIR, file), "utf8"));
    const title = meta.title || file.replace(/\.md$/, "");
    const stem = file.replace(/\.md$/, "");
    for (const c of chunkByHeading(body)) {
      records.push({
        id: `${stem}#${slug(c.heading)}`,
        source: meta.source || "Keyboard Notes (original)",
        file,
        title,
        heading: c.heading,
        embedText: `${title} — ${c.heading}\n${c.text}`,
        text: c.text,
      });
    }
  }
  return records;
}

// --- 2. Open Music Theory (vendored Markdown, CC BY-SA 4.0) --------------------------------

// Strip Jekyll/Markdown cruft that's noise in a text KB: images, reference-link definitions,
// liquid tags, and HTML; flatten links to their text.
function cleanOmt(body) {
  return body
    .replace(/!\[[^\]]*\]\[[^\]]*\]/g, "") // ![alt][ref] images
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "") // ![alt](url) images
    .replace(/^\[[^\]]+\]:\s.*$/gm, "") // [ref]: url definitions
    .replace(/\[([^\]]+)\]\[[^\]]*\]/g, "$1") // [text][ref] -> text
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1") // [text](url) -> text
    .replace(/\{\{.*?\}\}|\{%.*?%\}/g, "") // liquid
    .replace(/<[^>]+>/g, "") // HTML tags
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function collectOmt() {
  if (!existsSync(OMT_DIR)) return [];
  const records = [];
  for (const file of readdirSync(OMT_DIR).filter((f) => f.endsWith(".md")).sort()) {
    const { meta, body } = parseFrontmatter(readFileSync(join(OMT_DIR, file), "utf8"));
    const title = meta.title || file.replace(/\.md$/, "");
    const stem = file.replace(/\.md$/, "");
    for (const c of chunkByHeading(cleanOmt(body), title)) {
      records.push({
        id: `omt-${stem}#${slug(c.heading)}`,
        source: "Open Music Theory (openmusictheory.github.io), CC BY-SA 4.0",
        file: `vendor/open-music-theory/${file}`,
        title,
        heading: c.heading,
        embedText: `${title} — ${c.heading}\n${c.text}`,
        text: c.text,
      });
    }
  }
  return records;
}

// --- 3. music-theory-data (vendored YAML, CC BY-SA 4.0) ------------------------------------

// Intervals from the root, indexed by semitone (0–11), and a flat spelling from a C root. Used to
// turn a chord/scale's semitone bitmask into readable prose.
const INTERVAL = [
  "root",
  "minor 2nd",
  "major 2nd",
  "minor 3rd",
  "major 3rd",
  "perfect 4th",
  "tritone",
  "perfect 5th",
  "minor 6th",
  "major 6th",
  "minor 7th",
  "major 7th",
];
const NOTE_FROM_C = ["C", "D♭", "D", "E♭", "E", "F", "G♭", "G", "A♭", "A", "B♭", "B"];

// Decode the 12-bit "binary" field (bit i set ⇒ semitone i present) into a sorted semitone list.
const semitonesOf = (binary) => {
  const out = [];
  for (let i = 0; i < 12; i++) if (binary & (1 << i)) out.push(i);
  return out;
};
const binaryOf = (semis) => semis.reduce((b, s) => b | (1 << s), 0);

// Curated common scales (label → semitones from the root). Keeps the index focused on what a
// learner asks about rather than all ~400 omnibus scales; the vendored Scales.yaml stays complete.
const COMMON_SCALES = [
  ["Major (Ionian)", [0, 2, 4, 5, 7, 9, 11]],
  ["Natural minor (Aeolian)", [0, 2, 3, 5, 7, 8, 10]],
  ["Harmonic minor", [0, 2, 3, 5, 7, 8, 11]],
  ["Melodic minor (ascending)", [0, 2, 3, 5, 7, 9, 11]],
  ["Dorian", [0, 2, 3, 5, 7, 9, 10]],
  ["Phrygian", [0, 1, 3, 5, 7, 8, 10]],
  ["Lydian", [0, 2, 4, 6, 7, 9, 11]],
  ["Mixolydian", [0, 2, 4, 5, 7, 9, 10]],
  ["Locrian", [0, 1, 3, 5, 6, 8, 10]],
  ["Major pentatonic", [0, 2, 4, 7, 9]],
  ["Minor pentatonic", [0, 3, 5, 7, 10]],
  ["Blues", [0, 3, 5, 6, 7, 10]],
  ["Whole tone", [0, 2, 4, 6, 8, 10]],
  ["Octatonic (diminished)", [0, 2, 3, 5, 6, 8, 9, 11]],
  ["Phrygian dominant", [0, 1, 4, 5, 7, 8, 10]],
  ["Harmonic major", [0, 2, 4, 5, 7, 8, 11]],
  ["Chromatic", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]],
];

const MTD_SOURCE = "music-theory-data (Sean Colsen), CC BY-SA 4.0";
const spell = (semis) => semis.map((s) => NOTE_FROM_C[s]).join(" ");
const intervals = (semis) => semis.map((s) => INTERVAL[s]).join(", ");

function collectMusicTheoryData() {
  if (!existsSync(MTD_DIR)) return [];
  const records = [];

  // Every chord quality, decoded from its semitone bitmask.
  const chords = yaml.load(readFileSync(join(MTD_DIR, "Chords.yaml"), "utf8")) || [];
  for (const ch of chords) {
    const name = (ch.names && ch.names[0]) || `chord ${ch.binary}`;
    const abbr = ch.abbreviations && ch.abbreviations.length ? ` (abbreviated ${ch.abbreviations.join(", ")})` : "";
    const semis = semitonesOf(ch.binary);
    const text =
      `## ${name} chord\n` +
      `The ${name} chord${abbr} is built from the root upward as: ${intervals(semis)}. ` +
      `Spelled from a C root that is ${spell(semis)}.`;
    records.push({
      id: `mtd-chord-${slug(name)}`,
      source: MTD_SOURCE,
      file: "vendor/music-theory-data/Chords.yaml",
      title: "Chord qualities",
      heading: `${name} chord`,
      embedText: `Chord quality — ${name}\n${text}`,
      text,
    });
  }

  // Curated common scales; enrich with the dataset's own names/origins when the bitmask matches.
  const scales = yaml.load(readFileSync(join(MTD_DIR, "Scales.yaml"), "utf8")) || [];
  const byBinary = new Map(scales.map((s) => [s.binary, s]));
  for (const [label, semis] of COMMON_SCALES) {
    const match = byBinary.get(binaryOf(semis));
    const aliases = match?.names?.map((n) => n.name).filter((n) => n && n !== label) ?? [];
    const aka = aliases.length ? ` Also known as: ${[...new Set(aliases)].slice(0, 6).join(", ")}.` : "";
    const text =
      `## ${label} scale\n` +
      `The ${label} scale has ${semis.length} notes. From the root its intervals are: ${intervals(semis)}. ` +
      `Spelled from C: ${spell(semis)}.${aka}`;
    records.push({
      id: `mtd-scale-${slug(label)}`,
      source: MTD_SOURCE,
      file: "vendor/music-theory-data/Scales.yaml",
      title: "Scales",
      heading: `${label} scale`,
      embedText: `Scale — ${label}\n${text}`,
      text,
    });
  }
  return records;
}

// --- Embed + write ------------------------------------------------------------------------

const records = [...collectAuthored(), ...collectOmt(), ...collectMusicTheoryData()];
console.log(`Embedding ${records.length} chunks with ${EMBED.model}…`);

const { pipeline } = await import("@huggingface/transformers");
const extractor = await pipeline("feature-extraction", EMBED.model, { dtype: "fp32" });

const chunks = [];
for (const r of records) {
  const out = await extractor(r.embedText, { pooling: EMBED.pooling, normalize: EMBED.normalize });
  const vector = Array.from(out.data, (v) => Number(v.toFixed(6)));
  if (vector.length !== EMBED.dim) {
    throw new Error(`Embedding dim ${vector.length} != expected ${EMBED.dim} for ${r.id}`);
  }
  chunks.push({ id: r.id, source: r.source, file: r.file, title: r.title, heading: r.heading, text: r.text, vector });
}

const index = {
  schema: 1,
  ...EMBED,
  generatedAt: new Date().toISOString(),
  count: chunks.length,
  chunks,
};

writeFileSync(OUT, JSON.stringify(index));
const bySource = chunks.reduce((m, c) => ((m[c.source] = (m[c.source] || 0) + 1), m), {});
console.log(`Wrote ${OUT} — ${chunks.length} chunks, dim ${EMBED.dim}.`);
for (const [src, n] of Object.entries(bySource)) console.log(`  ${n}\t${src}`);
