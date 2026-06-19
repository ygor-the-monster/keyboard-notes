// One-time / occasional vendoring helper: downloads the upstream font "originals" we
// self-host, into fonts/ (committed, NOT shipped). We pull Google Fonts' variable
// latin + latin-ext woff2 — these cover every weight we use in ~28 KB each and are the
// smallest correct source for arbitrary Latin text (incl. FR/DE accents in latin-ext).
//
// These files are the INPUT to scripts/build-fonts.mjs, which subsets/copies them into
// the shipped public/fonts/. Re-run only when changing families/weights:
//   node scripts/fetch-font-originals.mjs
//
// Leland.otf (the SMuFL notation font) is vendored separately — it isn't a Google font.
import { writeFile, mkdir } from "node:fs/promises";

const OUT = new URL("../fonts/", import.meta.url);
// A desktop Chrome UA is required or the css2 API serves ttf (not woff2).
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

// slug = output basename stem; query = the css2 `family=` value (axes encode the weights
// we use). Variable requests (wght@a..b) yield one woff2 per range covering all weights.
const FAMILIES = [
  { slug: "source-sans-3", query: "Source+Sans+3:wght@400..700" },
  { slug: "source-code-pro", query: "Source+Code+Pro:wght@400..500" },
  // Serif 4 carries the optical-size axis + an italic; both directions are variable.
  { slug: "source-serif-4", query: "Source+Serif+4:ital,opsz,wght@0,8..60,400..700;1,8..60,400..700" },
  // IBM Plex Mono isn't variable on Google — one static woff2 per weight (glyph-icon labels).
  { slug: "ibm-plex-mono", query: "IBM+Plex+Mono:wght@200;300;500" },
];

// Only these subsets matter for us; the rest (cyrillic, greek, vietnamese) are dropped.
const WANTED_RANGES = new Set(["latin", "latin-ext"]);

async function get(url, asText) {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return asText ? res.text() : Buffer.from(await res.arrayBuffer());
}

// Walk the css2 response @font-face blocks; each is preceded by a `/* range */` comment and
// carries a font-style + (for static families) a font-weight we fold into the filename.
function parseFaces(css) {
  const faces = [];
  const re = /\/\*\s*([a-z-]+)\s*\*\/\s*@font-face\s*\{([^}]*)\}/g;
  let m;
  while ((m = re.exec(css))) {
    const range = m[1];
    if (!WANTED_RANGES.has(range)) continue;
    const block = m[2];
    const style = /font-style:\s*italic/.test(block) ? "italic" : "normal";
    const weightMatch = block.match(/font-weight:\s*([0-9]+)(?:\s+[0-9]+)?/);
    const variable = /font-weight:\s*[0-9]+\s+[0-9]+/.test(block); // "400 700" => variable
    const url = block.match(/url\((https:[^)]+\.woff2)\)/)?.[1];
    if (url) faces.push({ range, style, weight: weightMatch?.[1], variable, url });
  }
  return faces;
}

await mkdir(OUT, { recursive: true });
const recorded = [];
for (const { slug, query } of FAMILIES) {
  const css = await get(`https://fonts.googleapis.com/css2?family=${query}&display=swap`, true);
  for (const face of parseFaces(css)) {
    // Variable families: one file per (style, range). Static (Plex): also key on weight.
    const parts = [slug];
    if (face.style === "italic") parts.push("italic");
    if (!face.variable && face.weight) parts.push(face.weight);
    parts.push(face.range);
    const name = `${parts.join("-")}.woff2`;
    const buf = await get(face.url, false);
    await writeFile(new URL(name, OUT), buf);
    recorded.push({ name, bytes: buf.length, src: face.url });
    console.log(`↓ ${name.padEnd(40)} ${(buf.length / 1024).toFixed(1)} KB`);
  }
}

// Provenance: what each original is and where it came from (so a re-fetch is reproducible).
await writeFile(
  new URL("SOURCES.json", OUT),
  JSON.stringify({ note: "Vendored by scripts/fetch-font-originals.mjs", files: recorded }, null, 2) + "\n",
);
console.log(`\nWrote ${recorded.length} originals + SOURCES.json to fonts/`);
