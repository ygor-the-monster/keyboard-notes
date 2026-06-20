import { useEffect, useRef, useState } from "react";
import { MusicNoteIcon as MusicNote, ArrowsOutSimpleIcon as ArrowsOut } from "@phosphor-icons/react";
import { useTuner } from "./Tuner.hooks.ts";
import { useI18n } from "../../providers/I18nProvider/I18nProvider.tsx";
import { useRoute } from "../../providers/RouteProvider/RouteProvider.tsx";
import { usePref } from "../../providers/StoreProvider/StoreProvider.utils.ts";
import { NOTE_NAMES, noteToFreq } from "../../utils/pitch/pitch.ts";
import { Select, SelectItem } from "../fields/Select.tsx";
import ToolScreen from "../ToolScreen/ToolScreen.tsx";
import shared from "../../providers/ThemeProvider/ThemeProvider.module.css";
import t from "./Tuner.module.css";

const SCREEN_ID = "tuner";
const A4_OPTIONS = [440, 442];

// Instrument tuning targets as [noteIndex (0=C), octave]. Standard tunings, low→high string.
const INSTRUMENTS: Record<string, [number, number][]> = {
  guitar: [[4, 2], [9, 2], [2, 3], [7, 3], [11, 3], [4, 4]], // E2 A2 D3 G3 B3 E4
  bass: [[4, 1], [9, 1], [2, 2], [7, 2]], // E1 A1 D2 G2
  ukulele: [[7, 4], [0, 4], [4, 4], [9, 4]], // G4 C4 E4 A4 (reentrant)
  violin: [[7, 3], [2, 4], [9, 4], [4, 5]], // G3 D4 A4 E5
};
const INSTRUMENT_IDS = ["guitar", "bass", "ukulele", "violin"] as const;
const CUSTOM_OCTAVES = [1, 2, 3, 4, 5, 6];
const TRACE_LEN = 48; // ~4s of history at the ~11Hz sample rate below

const stringLabel = ([idx, oct]: [number, number]) => `${NOTE_NAMES[idx]}${oct}`;

// A floating utility dock (mirrors the Metronome): an agenda tab + expand affordance. The dock card
// stays a compact chromatic readout; the expanded screen adds a big gauge, tuning targets
// (instrument strings or a custom note) with distance-to-target, a stability trace and a signal
// meter. Reference-pitch playback intentionally lives in the Drone, not here.
export default function Tuner({ autostart = false }: { autostart?: boolean }) {
  const { t: tr } = useI18n();
  const { screen, openScreen, closeScreen } = useRoute();
  const [open, setOpen] = useState(false);
  const [a4, setA4] = usePref("tuner.a4", 440);
  const [target, setTarget] = usePref("tuner.target", "chromatic");
  const [customNote, setCustomNote] = usePref("tuner.customNote", 9); // A
  const [customOctave, setCustomOctave] = usePref("tuner.customOctave", 4);
  const { listening, reading, signalRef, toggle } = useTuner(a4);
  const onScreen = screen === SCREEN_ID;
  const [pinned, setPinned] = useState<number | null>(null); // pinned string index, or null = auto-nearest

  // Launched via the "Tuner" app shortcut (?tool=tuner): open and start listening once (toggle would
  // otherwise stop it on a re-run, so guard with a ref). This prompts for the mic.
  const startedRef = useRef(false);
  useEffect(() => {
    if (autostart && !startedRef.current) {
      startedRef.current = true;
      setOpen(true);
      toggle();
    }
  }, [autostart, toggle]);

  // Sample the input signal at ~11Hz (only on-screen while listening) to drive the level meter and
  // stability trace without re-rendering every animation frame.
  const [signal, setSignal] = useState({ level: 0, clarity: 0 });
  const [trace, setTrace] = useState<(number | null)[]>([]);
  useEffect(() => {
    if (!(onScreen && listening)) {
      setTrace([]);
      setSignal({ level: 0, clarity: 0 });
      return;
    }
    const id = setInterval(() => {
      const s = signalRef.current;
      setSignal({ level: s.level, clarity: s.clarity });
      setTrace((prev) => [...prev.slice(-(TRACE_LEN - 1)), s.cents]);
    }, 90);
    return () => clearInterval(id);
  }, [onScreen, listening, signalRef]);

  const inTuneDock = reading && Math.abs(reading.cents) <= 5;

  // ----- Resolve the active target + deviation for the expanded gauge -----
  const strings = INSTRUMENTS[target] ?? null;
  const devFrom = (idx: number, oct: number) =>
    reading ? Math.round(1200 * Math.log2(reading.freq / noteToFreq(idx, oct, a4))) : 0;

  let dev = 0;
  let displayNote = "—";
  let displayOctave: number | null = null;
  let nearestIdx = -1;
  if (strings) {
    if (reading) {
      nearestIdx = strings.reduce(
        (best, _s, i) =>
          Math.abs(devFrom(strings[i][0], strings[i][1])) <
          Math.abs(devFrom(strings[best][0], strings[best][1]))
            ? i
            : best,
        0,
      );
    }
    const activeIdx = pinned ?? (nearestIdx >= 0 ? nearestIdx : null);
    if (activeIdx != null) {
      const [i, o] = strings[activeIdx];
      dev = devFrom(i, o);
      displayNote = NOTE_NAMES[i];
      displayOctave = o;
    }
  } else if (target === "custom") {
    dev = devFrom(customNote, customOctave);
    displayNote = NOTE_NAMES[customNote];
    displayOctave = customOctave;
  } else {
    dev = reading?.cents ?? 0;
    displayNote = reading?.note ?? "—";
    displayOctave = reading?.octave ?? null;
  }
  const targeted = strings != null || target === "custom";
  const inTune = reading != null && Math.abs(dev) <= 5;
  const needlePct = 50 + Math.max(-50, Math.min(50, dev));

  // Stability trace path — break the line across gaps (frames with no clear pitch).
  let tracePath = "";
  let penDown = false;
  trace.forEach((c, i) => {
    if (c == null) {
      penDown = false;
      return;
    }
    const x = (i / (TRACE_LEN - 1)) * 100;
    const y = 20 - (Math.max(-50, Math.min(50, c)) / 50) * 18;
    tracePath += `${penDown ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)} `;
    penDown = true;
  });

  const a4Row = (
    <div className={t.refRow} role="group" aria-label={tr("tuner.reference")}>
      {A4_OPTIONS.map((hz) => (
        <button
          key={hz}
          type="button"
          className={`${t.refBtn}${a4 === hz ? ` ${t.refBtnOn}` : ""}`}
          aria-pressed={a4 === hz}
          onClick={() => setA4(hz)}
        >
          A={hz}
        </button>
      ))}
    </div>
  );

  const startBtn = (
    <button
      type="button"
      className={`${shared.btnMagenta} ${t.start}`}
      onClick={toggle}
      style={listening ? { background: "var(--accent-strong)" } : undefined}
    >
      {listening ? tr("tuner.stop") : tr("tuner.startListening")}
    </button>
  );

  const dockClass = [t.dock, "no-print", open && t.open, listening && t.live].filter(Boolean).join(" ");

  return (
    <>
      <div className={dockClass}>
        <div className={t.tab}>
          <button
            type="button"
            className={t.tabExpand}
            onClick={() => openScreen(SCREEN_ID)}
            aria-label={`${tr("screen.expand")} — ${tr("tuner.name")}`}
          >
            <ArrowsOut size={16} aria-hidden />
          </button>
          <button
            type="button"
            className={t.tabToggle}
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-label={open ? tr("tuner.hide") : tr("tuner.show")}
          >
            <MusicNote size={22} aria-hidden />
            <span className={t.tabLabel}>{tr("tuner.name")}</span>
            <span className={t.tabNote}>{reading ? reading.note : "–"}</span>
          </button>
        </div>

        {!onScreen && (
          <div className={t.card}>
            <div className={t.head}>
              <MusicNote size={18} aria-hidden />
              <span>{tr("tuner.noteIdentifier")}</span>
            </div>
            <div className={`${t.readout}${inTuneDock ? ` ${t.inTune}` : ""}`}>
              <span className={t.note}>
                {reading ? reading.note : "—"}
                {reading && <sub className={t.octave}>{reading.octave}</sub>}
              </span>
              <span className={t.hz}>
                {reading ? `${reading.hz} Hz` : listening ? tr("tuner.listening") : "—"}
              </span>
            </div>
            <div className={t.meter}>
              <span className={t.meterCenter} />
              {reading && (
                <span
                  className={t.needle}
                  style={{ left: `${50 + Math.max(-50, Math.min(50, reading.cents))}%` }}
                />
              )}
            </div>
            <div className={t.meterScale}>
              <span>♭ {tr("tuner.flat")}</span>
              <span>{reading ? `${reading.cents > 0 ? "+" : ""}${reading.cents}¢` : ""}</span>
              <span>{tr("tuner.sharp")} ♯</span>
            </div>
            {a4Row}
            {startBtn}
          </div>
        )}
      </div>

      {onScreen && (
        <ToolScreen
          title={tr("tuner.name")}
          icon={MusicNote}
          accent="--s-cinnamon-strong"
          onClose={closeScreen}
        >
          <div className={`${t.gauge}${inTune ? ` ${t.gaugeInTune}` : ""}`}>
            <div className={t.gaugeNote}>
              {displayNote}
              {displayOctave != null && <sub className={t.octave}>{displayOctave}</sub>}
            </div>
            <div className={t.gaugeCents}>
              {reading ? `${dev > 0 ? "+" : ""}${dev}¢` : listening ? tr("tuner.listening") : "—"}
            </div>
            <div className={t.bigMeter}>
              <span className={t.meterCenter} />
              {reading && <span className={t.bigNeedle} style={{ left: `${needlePct}%` }} />}
            </div>
            <div className={t.meterScale}>
              <span>♭</span>
              <span>{inTune ? tr("tuner.inTuneMsg") : ""}</span>
              <span>♯</span>
            </div>
            {targeted && (
              <div className={t.heard}>
                {reading ? `${tr("tuner.heard")} ${reading.note}${reading.octave}` : ""}
              </div>
            )}
          </div>

          <Select
            label={tr("tuner.target")}
            selectedKey={target}
            onSelectionChange={(k) => {
              setTarget(String(k));
              setPinned(null);
            }}
          >
            <SelectItem id="chromatic">{tr("tuner.chromatic")}</SelectItem>
            {INSTRUMENT_IDS.map((id) => (
              <SelectItem key={id} id={id}>
                {tr(`tuner.instrument.${id}`)}
              </SelectItem>
            ))}
            <SelectItem id="custom">{tr("tuner.custom")}</SelectItem>
          </Select>

          {strings && (
            <div className={t.strings} role="group" aria-label={tr("tuner.strings")}>
              {strings.map((s, i) => (
                <button
                  key={i}
                  type="button"
                  className={[
                    t.stringBtn,
                    pinned == null && i === nearestIdx && reading && t.stringNearest,
                    pinned === i && t.stringPinned,
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  aria-pressed={pinned === i}
                  onClick={() => setPinned((p) => (p === i ? null : i))}
                >
                  {stringLabel(s)}
                </button>
              ))}
            </div>
          )}

          {target === "custom" && (
            <div className={t.row}>
              <Select
                label={tr("tuner.note")}
                selectedKey={String(customNote)}
                onSelectionChange={(k) => setCustomNote(Number(k))}
              >
                {NOTE_NAMES.map((n, i) => (
                  <SelectItem key={i} id={String(i)}>
                    {n}
                  </SelectItem>
                ))}
              </Select>
              <Select
                label={tr("tuner.octave")}
                selectedKey={String(customOctave)}
                onSelectionChange={(k) => setCustomOctave(Number(k))}
              >
                {CUSTOM_OCTAVES.map((o) => (
                  <SelectItem key={o} id={String(o)}>
                    {String(o)}
                  </SelectItem>
                ))}
              </Select>
            </div>
          )}

          <div className={t.traceWrap}>
            <span className={t.fieldLabel}>{tr("tuner.stability")}</span>
            <svg className={t.trace} viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden>
              <line x1="0" y1="20" x2="100" y2="20" className={t.traceMid} />
              {tracePath && <path d={tracePath} className={t.tracePath} fill="none" />}
            </svg>
          </div>

          <div className={t.signalWrap}>
            <span className={t.fieldLabel}>{tr("tuner.signal")}</span>
            <div className={t.signalBar}>
              <span className={t.signalFill} style={{ width: `${Math.round(signal.level * 100)}%` }} />
            </div>
            {listening && signal.level < 0.06 && <span className={t.weak}>{tr("tuner.weakSignal")}</span>}
          </div>

          {a4Row}
          {startBtn}
        </ToolScreen>
      )}
    </>
  );
}
