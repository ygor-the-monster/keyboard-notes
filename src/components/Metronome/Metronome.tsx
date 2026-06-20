import { useEffect, useRef, useState } from "react";
import {
  MetronomeIcon,
  HandTapIcon as HandTap,
  ArrowsOutSimpleIcon as ArrowsOut,
} from "@phosphor-icons/react";
import { useMetronome, type AccentLevel, type ToneSpec } from "./Metronome.hooks.ts";
import { useI18n } from "../../providers/I18nProvider/I18nProvider.tsx";
import { useRoute } from "../../providers/RouteProvider/RouteProvider.tsx";
import { usePref } from "../../providers/StoreProvider/StoreProvider.utils.ts";
import { clamp } from "../../utils/numeric/numeric.ts";
import { Select, SelectItem } from "../fields/Select.tsx";
import { Slider } from "../fields/Slider.tsx";
import ToolScreen from "../ToolScreen/ToolScreen.tsx";
import shared from "../../providers/ThemeProvider/ThemeProvider.module.css";
import m from "./Metronome.module.css";

const SCREEN_ID = "metronome";

// Click sound presets — the weak/strong oscillator voices. Selectable from the full screen only.
const TONES: Record<string, ToneSpec> = {
  classic: { accent: { freq: 1600, type: "sine" }, beat: { freq: 1000, type: "sine" } },
  wood: { accent: { freq: 1100, type: "triangle" }, beat: { freq: 760, type: "triangle" } },
  beep: { accent: { freq: 1320, type: "square" }, beat: { freq: 880, type: "square" } },
};
const TONE_IDS = ["classic", "wood", "beep"] as const;
const SUBDIVS = [1, 2, 3, 4] as const; // none, eighths, triplets, sixteenths
const SUBDIV_KEYS: Record<number, string> = { 1: "none", 2: "eighths", 3: "triplets", 4: "sixteenths" };
const POLYS = [0, 2, 3, 4, 5, 6, 7] as const; // 0 = off

// Build the effective accent pattern for the current meter: reuse stored levels, default a strong
// downbeat + weak rest, so changing the time signature always yields a sensible pattern.
function buildPattern(stored: AccentLevel[], beats: number): AccentLevel[] {
  return Array.from({ length: beats }, (_, i) => stored[i] ?? (i === 0 ? 2 : 1));
}

// A floating utility dock pinned to the left edge: an agenda-style tab that slides the metronome
// card in and out, plus an expand affordance that opens the full-screen view. Tempo / time
// signature / accent pattern / sound persist (localStorage). The full screen adds the visual beat
// indicator (tap a beat to cycle its accent: weak → strong → muted) and the sound picker.
export default function Metronome({ autostart = false }: { autostart?: boolean }) {
  const { t } = useI18n();
  const { screen, openScreen, closeScreen } = useRoute();
  const [open, setOpen] = useState(false);
  const [bpm, setBpm] = usePref("metro.bpm", 90);
  const [beats, setBeats] = usePref("metro.beats", 4);
  const [storedPattern, setStoredPattern] = usePref<AccentLevel[]>("metro.pattern", [2, 1, 1, 1]);
  const [toneId, setToneId] = usePref("metro.tone", "classic");
  const [subdiv, setSubdiv] = usePref("metro.subdiv", 1);
  const [poly, setPoly] = usePref("metro.poly", 0);
  const onScreen = screen === SCREEN_ID;

  const pattern = buildPattern(storedPattern, beats);
  const sound = TONES[toneId] ?? TONES.classic;
  const { running, currentBeat, currentPoly, start, toggle } = useMetronome({
    bpm,
    beats,
    pattern,
    sound,
    subdiv,
    poly,
  });

  // Launched via the "Metronome" app shortcut (?tool=metronome): open the panel and start ticking.
  // start() is idempotent, so the effect re-running is harmless.
  useEffect(() => {
    if (autostart) {
      setOpen(true);
      start();
    }
  }, [autostart, start]);

  // Tap tempo — average the intervals of recent taps; a gap > 2s starts a fresh count.
  const tapsRef = useRef<number[]>([]);
  function tap() {
    const now = performance.now();
    const taps = tapsRef.current.filter((t0) => now - t0 < 2000);
    taps.push(now);
    tapsRef.current = taps;
    if (taps.length >= 2) {
      const avg = (taps[taps.length - 1] - taps[0]) / (taps.length - 1);
      setBpm(clamp(Math.round(60000 / avg), 40, 220));
    }
  }

  // Cycle one beat's accent: weak → strong → muted → weak. Functional update off the stored
  // pattern (reconciled to the current meter) so rapid taps compose correctly.
  function cycleBeat(i: number) {
    setStoredPattern((prev) => {
      const next = buildPattern(prev, beats);
      next[i] = ((next[i] + 1) % 3) as AccentLevel;
      return next;
    });
  }

  // Tempo + meter — shared verbatim by the dock card and the full screen, so the single mounted
  // instance keeps ticking when it swaps layouts.
  const controls = (
    <>
      <Slider
        label={t("metronome.tempo")}
        minValue={40}
        maxValue={220}
        value={bpm}
        onChange={setBpm}
        format={(v) => `${v} BPM`}
      />
      <Select
        label={t("metronome.timeSignature")}
        selectedKey={String(beats)}
        onSelectionChange={(k) => setBeats(Number(k))}
      >
        <SelectItem id="4">4/4</SelectItem>
        <SelectItem id="3">3/4</SelectItem>
        <SelectItem id="2">2/4</SelectItem>
        <SelectItem id="6">6/8</SelectItem>
      </Select>
    </>
  );

  const transport = (
    <div className={m.metroButtons}>
      <button type="button" className={m.metroTap} onClick={tap}>
        <HandTap size={18} aria-hidden />
        {t("metronome.tap")}
      </button>
      <button
        type="button"
        className={`${shared.btnMagenta} ${m.metroStart}`}
        onClick={toggle}
        style={running ? { background: "var(--accent-strong)" } : undefined}
      >
        {running ? t("metronome.stop") : t("metronome.start")}
      </button>
    </div>
  );

  // Screen-only: interactive beat indicator. Pips light on the sounding beat and double as the
  // accent editor (tap to cycle). Dim/dashed = muted, small = weak, large = strong.
  const levelName = (lvl: AccentLevel) =>
    lvl === 2
      ? t("metronome.levelStrong")
      : lvl === 1
        ? t("metronome.levelWeak")
        : t("metronome.levelMuted");
  const beatIndicator = (
    <div className={m.beats} role="group" aria-label={t("metronome.accent")}>
      {pattern.map((lvl, i) => (
        <button
          key={i}
          type="button"
          className={[
            m.pip,
            lvl === 2 && m.pipStrong,
            lvl === 0 && m.pipMute,
            running && i === currentBeat && m.pipActive,
          ]
            .filter(Boolean)
            .join(" ")}
          onClick={() => cycleBeat(i)}
          aria-label={`${t("metronome.beat")} ${i + 1}: ${levelName(lvl)}`}
        />
      ))}
    </div>
  );

  // Polyrhythm layer indicator (indigo, to contrast the magenta main layer). Shown only when on.
  const polyIndicator = poly > 1 && (
    <div className={m.polyBeats} role="group" aria-label={t("metronome.polyrhythm")}>
      {Array.from({ length: poly }, (_, i) => (
        <span
          key={i}
          className={[m.polyPip, running && i === currentPoly && m.pipActive].filter(Boolean).join(" ")}
        />
      ))}
    </div>
  );

  const subdivField = (
    <Select
      label={t("metronome.subdivision")}
      selectedKey={String(subdiv)}
      onSelectionChange={(k) => setSubdiv(Number(k))}
    >
      {SUBDIVS.map((n) => (
        <SelectItem key={n} id={String(n)}>
          {t(`metronome.sub.${SUBDIV_KEYS[n]}`)}
        </SelectItem>
      ))}
    </Select>
  );

  const polyField = (
    <Select
      label={t("metronome.polyrhythm")}
      selectedKey={poly > 1 ? String(poly) : "off"}
      onSelectionChange={(k) => setPoly(k === "off" ? 0 : Number(k))}
    >
      <SelectItem id="off">{t("metronome.polyOff")}</SelectItem>
      {POLYS.filter((n) => n > 1).map((n) => (
        <SelectItem key={n} id={String(n)}>
          {n}:{beats}
        </SelectItem>
      ))}
    </Select>
  );

  const soundField = (
    <Select
      label={t("metronome.sound")}
      selectedKey={toneId}
      onSelectionChange={(k) => setToneId(String(k))}
    >
      {TONE_IDS.map((id) => (
        <SelectItem key={id} id={id}>
          {t(`metronome.tone.${id}`)}
        </SelectItem>
      ))}
    </Select>
  );

  const dockClass = [m.metroDock, "no-print", open && m.open, running && m.running]
    .filter(Boolean)
    .join(" ");

  return (
    <>
      <div className={dockClass}>
        <div className={m.metroTab}>
          <button
            type="button"
            className={m.metroExpand}
            onClick={() => openScreen(SCREEN_ID)}
            aria-label={`${t("screen.expand")} — ${t("metronome.name")}`}
          >
            <ArrowsOut size={16} aria-hidden />
          </button>
          <button
            type="button"
            className={m.metroToggle}
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-label={open ? t("metronome.hide") : t("metronome.show")}
          >
            <MetronomeIcon size={22} aria-hidden />
            <span className={m.metroTabLabel}>{t("metronome.name")}</span>
            <span className={m.metroTabBpm}>{bpm}</span>
          </button>
        </div>

        {/* Card hidden while the screen owns the controls (it sits behind the overlay anyway). */}
        {!onScreen && (
          <div className={m.metroCard}>
            <div className={m.metroHead}>
              <MetronomeIcon size={18} aria-hidden />
              <span>{t("metronome.name")}</span>
            </div>
            {controls}
            {transport}
          </div>
        )}
      </div>

      {onScreen && (
        <ToolScreen
          title={t("metronome.name")}
          icon={MetronomeIcon}
          accent="--s-magenta"
          onClose={closeScreen}
        >
          {beatIndicator}
          {polyIndicator}
          {controls}
          {subdivField}
          {polyField}
          {soundField}
          {transport}
        </ToolScreen>
      )}
    </>
  );
}
