// Regenerates the per-tool install screenshots (manifest "screenshots" carousel) by driving the
// built app with Playwright. Spins up `vite preview` over ./dist, seeds a nice demo state per tool
// via localStorage (light theme, English, sensible presets), opens each tool's screen at both PWA
// form factors, and writes public/screenshots/tool-<id>-<wide|narrow>.png.
//
//   npm run screenshots     (builds first, then runs this)
//
// Re-run whenever a tool's screen changes. Captured states are scripted here, not hand-set, so the
// carousel stays reproducible.
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

const PORT = 4188;
const BASE = `http://localhost:${PORT}`;
const OUT = "public/screenshots";

const dayKey = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const dayAgo = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return dayKey(d);
};

// A few days of practice history (minutes), today in progress — gives the timer a streak + chart.
const goalLog = {};
for (const [n, min] of Object.entries({ 0: 12, 1: 25, 2: 22, 3: 24, 4: 30, 5: 20, 7: 24, 8: 21 }))
  goalLog[dayAgo(Number(n))] = min * 60;

// localStorage seeds (raw stored values: usePref JSON-encodes; locale is stored raw).
const PREFS = {
  "pianoNotes.locale": "en",
  "pianoNotes.pref.theme": JSON.stringify("light"),
  "pianoNotes.pref.metro.bpm": "96",
  "pianoNotes.pref.metro.pattern": "[1,2,2,1]",
  "pianoNotes.pref.metro.subdiv": "2",
  "pianoNotes.pref.metro.poly": "3",
  "pianoNotes.pref.tuner.target": JSON.stringify("guitar"),
  "pianoNotes.pref.ref.a4": "440",
  "pianoNotes.pref.drone.note": "2",
  "pianoNotes.pref.drone.chord": JSON.stringify("tanpura"),
  "pianoNotes.pref.drone.timbre": JSON.stringify("warm"),
  "pianoNotes.pref.drone.scale": JSON.stringify("dorian"),
  "pianoNotes.pref.scratch.global": JSON.stringify(
    "Work on the bridge — bars 17–24.\nKeep the left hand soft under the melody.\nMetronome at 80, then push to 96.",
  ),
  "pianoNotes.pref.scratchTodos.global": JSON.stringify([
    { id: "a", text: "Warm up — C & G scales", done: true },
    { id: "b", text: "Bars 17–24 hands separately", done: false },
    { id: "c", text: "Record a take to review", done: false },
  ]),
  "pianoNotes.pref.goal.target": "20",
  "pianoNotes.pref.goal.log": JSON.stringify(goalLog),
};

// Tools to shoot. `tap` clicks white keys on the chord keyboard (C, E, G) since its chord is React
// state, not a pref.
const TOOLS = [
  { id: "metronome" },
  { id: "tuner" },
  { id: "drone" },
  { id: "scratchpad" },
  { id: "chords", tap: [0, 2, 4] },
  { id: "practice" },
  { id: "syntax" },
];
const FACTORS = [
  ["wide", 1440, 900],
  ["narrow", 412, 915],
];

const server = spawn("npx", ["vite", "preview", "--port", String(PORT), "--strictPort"], {
  stdio: "ignore",
});
try {
  // Wait for the preview server.
  for (let i = 0; i < 80; i++) {
    try {
      if ((await fetch(BASE)).ok) break;
    } catch {
      /* not up yet */
    }
    await sleep(200);
  }

  const browser = await chromium.launch();
  const context = await browser.newContext({ deviceScaleFactor: 1 });
  await context.addInitScript((prefs) => {
    for (const [k, v] of Object.entries(prefs)) localStorage.setItem(k, v);
  }, PREFS);
  const page = await context.newPage();

  for (const t of TOOLS) {
    for (const [fac, w, h] of FACTORS) {
      await page.setViewportSize({ width: w, height: h });
      await page.goto(`${BASE}/#${t.id}`, { waitUntil: "networkidle" });
      if (t.tap) {
        await page.waitForSelector('[class*="kbdWide"] rect');
        await sleep(350); // let the screen-in animation settle + handlers attach
        for (const i of t.tap) {
          // White-key centres are clear of the overlapping black keys, so a plain click lands true
          // (the screen-in animation has settled by now).
          await page.locator('[class*="kbdWide"] rect').nth(i).click();
          await sleep(140);
        }
      }
      await sleep(400); // let the screen-in animation settle
      const path = `${OUT}/tool-${t.id}-${fac}.png`;
      await page.screenshot({ path });
      console.log(`Wrote ${path} (${w}x${h})`);
    }
  }

  await browser.close();
} finally {
  server.kill();
}
