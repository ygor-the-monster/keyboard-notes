// Font build step (run in CI before `vite build`, and committed output for local dev):
// reads the vendored originals in fonts/ and produces the SHIPPED woff2 in public/fonts/.
//
//   Text fonts (Source Sans 3 / Serif 4 / Code Pro, IBM Plex Mono)
//     → copied verbatim. They're already Google's latin + latin-ext woff2: range-subset,
//       woff2-compressed, and variable across the weights we use. Because these render
//       ARBITRARY user text (incl. FR/DE accents in latin-ext), glyph-level subsetting
//       would corrupt content — so range-subset is the correct, final form.
//
//   Leland (SMuFL notation glyph font)
//     → genuinely subset. The full .otf carries thousands of engraving glyphs; the app
//       renders exactly the 29 codepoints in SMUFL (src/components/ScoreCell/ScoreCell.utils.ts).
//       Subsetting to those + converting OTF→woff2 takes ~89 KB → a few KB.
//
// Originals in fonts/ are never shipped or mutated, so re-running is always safe:
//   npm run fonts:build
import subsetFont from "subset-font";
import { readFile, writeFile, mkdir, readdir, copyFile, rm } from "node:fs/promises";

const SRC = new URL("../fonts/", import.meta.url);
const OUT = new URL("../public/fonts/", import.meta.url);

// The exact SMuFL codepoints the toolbar renders in Leland. Keep in sync with the SMUFL
// map in src/components/ScoreCell/ScoreCell.utils.ts (accidentals, articulations, ornaments,
// dynamics, rests, grace marks). Subsetting to just these is the whole point of this step.
const LELAND_CODEPOINTS = [
  0xe260, 0xe261, 0xe262, 0xe4a0, 0xe4a2, 0xe4a4, 0xe4ac, 0xe4c0, 0xe566, 0xe56c, 0xe56d, 0xe567,
  0xe568, 0xe520, 0xe52b, 0xe52a, 0xe52c, 0xe52d, 0xe522, 0xe52f, 0xe530, 0xe524, 0xe525, 0xe53e,
  0xe53f, 0xe4e5, 0xe4e2, 0xe562, 0xe560,
];

const kb = (n) => `${(n / 1024).toFixed(1)} KB`;

await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });

// 1. Copy the already-optimal text-font originals through to the shipped dir.
let copied = 0;
let copiedBytes = 0;
for (const name of await readdir(SRC)) {
  if (!name.endsWith(".woff2")) continue; // skip Leland.otf + SOURCES.json
  const buf = await readFile(new URL(name, SRC));
  await copyFile(new URL(name, SRC), new URL(name, OUT));
  copied++;
  copiedBytes += buf.length;
}
console.log(`Copied ${copied} text-font woff2 (${kb(copiedBytes)}) → public/fonts/`);

// 2. Subset Leland to the codepoints actually rendered, OTF → woff2.
const lelandSrc = await readFile(new URL("Leland.otf", SRC));
const text = String.fromCodePoint(...LELAND_CODEPOINTS);
const lelandOut = await subsetFont(lelandSrc, text, { targetFormat: "woff2" });
await writeFile(new URL("Leland.woff2", OUT), lelandOut);
console.log(
  `Subset Leland ${kb(lelandSrc.length)} → ${kb(lelandOut.length)} ` +
    `(${LELAND_CODEPOINTS.length} glyphs, ${((1 - lelandOut.length / lelandSrc.length) * 100).toFixed(0)}% smaller)`,
);
