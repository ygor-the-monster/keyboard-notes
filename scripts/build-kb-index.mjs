// Build the music-tutor retrieval index from the Markdown sources in src/prompts/kb/.
//
// Each source file is split into chunks (one per "## " heading), every chunk is embedded with a
// small sentence-transformer (the SAME model the browser uses at query time), and the result is
// written to public/kb-index.json. The index is self-describing — it records the model, dimension,
// pooling, normalization, and the retrieval query prefix it was built with — so the runtime embeds
// queries with exactly these settings and the two halves can never silently drift apart.
//
// Runs in Node via @huggingface/transformers (the same dependency the app bundles), on CPU. Invoke
// with `npm run kb:index`, or let the "Regenerate KB Index" GitHub Action run it and commit the
// output. The embedding model downloads from the HF hub on first run and is cached after.
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const KB_DIR = join(__dirname, "..", "src", "prompts", "kb");
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

// Parse the leading `---\n...\n---` YAML-ish frontmatter into a flat string map, and return the
// remaining body. Only simple `key: value` lines are supported (enough for our fields).
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

// Split a document body into chunks at each "## " heading. Each chunk keeps its heading line so the
// retrieved text reads as a self-contained section.
function chunk(body) {
  const out = [];
  const parts = body.split(/\n(?=## )/);
  for (const part of parts) {
    const text = part.trim();
    if (!text.startsWith("## ")) continue; // skip any preamble before the first heading
    const heading = text.slice(3, text.indexOf("\n") === -1 ? undefined : text.indexOf("\n")).trim();
    out.push({ heading, text });
  }
  return out;
}

function slug(s) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

// Gather every source chunk with its metadata.
const files = readdirSync(KB_DIR)
  .filter((f) => f.endsWith(".md") && f !== "SOURCES.md")
  .sort();

const records = [];
for (const file of files) {
  const { meta, body } = parseFrontmatter(readFileSync(join(KB_DIR, file), "utf8"));
  const title = meta.title || file.replace(/\.md$/, "");
  for (const c of chunk(body)) {
    records.push({
      id: `${file.replace(/\.md$/, "")}#${slug(c.heading)}`,
      source: meta.source || file,
      file,
      title,
      heading: c.heading,
      // Embed the file title alongside the section so retrieval has the document-level context
      // (e.g. "Scales and modes — Dorian"); store the section text as what gets shown to the model.
      embedText: `${title} — ${c.heading}\n${c.text}`,
      text: c.text,
    });
  }
}

console.log(`Embedding ${records.length} chunks from ${files.length} files with ${EMBED.model}…`);

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
console.log(`Wrote ${OUT} — ${chunks.length} chunks, dim ${EMBED.dim}.`);
