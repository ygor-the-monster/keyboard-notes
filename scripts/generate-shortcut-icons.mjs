// Renders the manifest "shortcuts" (quick-action) icons from Phosphor glyphs, so each jump-list
// entry is recognizable instead of reusing the app icon. Each icon is an accent-filled squircle —
// the tool's own resting accent (light scheme, mirrored from ThemeProvider.globals.css) — with a
// paper-cream knockout glyph that stays legible on any launcher background. The glyph paths are read
// straight from @phosphor-icons/react so they track the installed version. Re-run with
// `npm run icons:shortcuts` if the set or accents change.
import sharp from "sharp";
import fs from "node:fs";

const SIZE = 192; // referenced by the manifest as 192x192
const RX = 56; // ~22% corner radius — squircle-ish, survives a round mask
const SCALE = 0.6; // glyph fills ~60% of the tile, leaving a safe-zone margin
const CREAM = "#FBFAF7"; // paper-cream knockout glyph (on the accent-filled tiles)
const INK = "rgb(19,19,19)"; // --s-ink — manuscript ink (on the ivory tile)
const WEIGHT = "regular"; // crisper than the in-UI "light" weight at small launcher sizes

// Pull one weight's path data out of a Phosphor def module by text (the modules are React.createElement
// factories that need React to import, so we parse rather than execute them).
function glyphPath(name) {
  const txt = fs.readFileSync(`node_modules/@phosphor-icons/react/dist/defs/${name}.es.js`, "utf8");
  const i = txt.indexOf(`"${WEIGHT}"`);
  const m = i >= 0 && txt.slice(i, i + 2000).match(/d:\s*"([^"]+)"/);
  if (!m) throw new Error(`No ${WEIGHT} path found for ${name}`);
  return m[1];
}

// glyph: Phosphor icon name · bg: the tile fill · ink: the glyph color · border: optional hairline
// (the pale ivory tile needs one to stay defined on light launcher surfaces).
const ICONS = [
  // New lesson = a blank ivory page (--canvas), written in manuscript ink.
  { out: "shortcut-new", glyph: "NotePencil", bg: "#f6f5f1", ink: INK, border: "rgba(19,19,19,0.10)" },
  { out: "shortcut-metronome", glyph: "Metronome", bg: "rgb(217,35,97)", ink: CREAM }, // --s-magenta
  { out: "shortcut-tuner", glyph: "MusicNote", bg: "rgb(131,67,43)", ink: CREAM }, // --s-cinnamon-strong
  { out: "shortcut-drone", glyph: "Waveform", bg: "rgb(150,110,0)", ink: CREAM }, // --s-gold-strong
  { out: "shortcut-scratchpad", glyph: "NotePencil", bg: "rgb(35,101,224)", ink: CREAM }, // --s-blue
  { out: "shortcut-chords", glyph: "PianoKeys", bg: "rgb(7,129,109)", ink: CREAM }, // --s-seafoam
  { out: "shortcut-practice", glyph: "Timer", bg: "rgb(84,90,104)", ink: CREAM }, // --s-silver-strong
  { out: "shortcut-syntax", glyph: "Code", bg: "rgb(154,71,226)", ink: CREAM }, // --s-purple
];

const offset = (256 * (1 - SCALE)) / 2; // center the scaled 256-unit glyph
for (const { out, glyph, bg, ink, border } of ICONS) {
  // Inset the border by half its width so the stroke stays inside the 256 box.
  const stroke = border ? `<rect x="2" y="2" width="252" height="252" rx="${RX - 2}" fill="none" stroke="${border}" stroke-width="4"/>` : "";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 256 256">
  <rect width="256" height="256" rx="${RX}" fill="${bg}"/>
  ${stroke}
  <g transform="translate(${offset},${offset}) scale(${SCALE})"><path d="${glyphPath(glyph)}" fill="${ink}"/></g>
</svg>`;
  await sharp(Buffer.from(svg)).png().toFile(`public/icons/${out}.png`);
  console.log(`Wrote public/icons/${out}.png (${SIZE}x${SIZE}) — ${glyph} on ${bg}`);
}
