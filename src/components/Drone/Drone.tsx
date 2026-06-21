import { useState } from "react";
import { WaveformIcon as Waveform, ArrowsOutSimpleIcon as ArrowsOut } from "@phosphor-icons/react";
import { useI18n } from "../../providers/I18nProvider/I18nProvider.tsx";
import { useRoute } from "../../providers/RouteProvider/RouteProvider.tsx";
import { usePref } from "../../providers/StoreProvider/StoreProvider.utils.ts";
import { useRefPitch } from "../../hooks/useRefPitch.ts";
import { useDrone, CHORD_IDS, TIMBRE_IDS } from "./Drone.hooks.ts";
import { NOTE_NAMES, SCALES } from "../../utils/pitch/pitch.ts";
import { Select, SelectItem } from "../fields/Select.tsx";
import { Slider } from "../fields/Slider.tsx";
import ToolScreen from "../ToolScreen/ToolScreen.tsx";
import shared from "../../providers/ThemeProvider/ThemeProvider.module.css";
import s from "./Drone.module.css";

const SCREEN_ID = "drone";
const OCTAVES = [2, 3, 4, 5];
const SCREEN_OCTAVES = [1, 2, 3, 4, 5, 6];
const SCALE_IDS = ["major", "minor", "dorian", "mixolydian", "pentMajor", "pentMinor"];
const A4_OPTIONS = [440, 442];

// Sustained reference pitch (drone) for intonation / ear-training. The dock card is a compact
// single control; the expanded screen layers chords, picks a warmer timbre, shares the tuner's A
// reference, and shows a scale to improvise over the drone. UI only — the oscillators and click-free
// ramps live in useDrone + the shared audio engine.
export default function Drone() {
  const { t } = useI18n();
  const { screen, openScreen, closeScreen } = useRoute();
  const [open, setOpen] = useState(false);
  const [note, setNote] = usePref("drone.note", 9); // A
  const [octave, setOctave] = usePref("drone.octave", 3);
  const [volume, setVolume] = usePref("drone.volume", 0.3);
  const [chord, setChord] = usePref("drone.chord", "root");
  const [timbre, setTimbre] = usePref("drone.timbre", "triangle");
  const [scale, setScale] = usePref("drone.scale", "major");
  const [a4, setA4] = useRefPitch();
  const onScreen = screen === SCREEN_ID;
  const { playing, toggle } = useDrone({ note, octave, volume, chord, timbre, a4 });

  const noteSelect = (
    <Select
      label={t("drone.note")}
      selectedKey={String(note)}
      onSelectionChange={(k) => setNote(Number(k))}
    >
      {NOTE_NAMES.map((n, i) => (
        <SelectItem key={i} id={String(i)}>
          {n}
        </SelectItem>
      ))}
    </Select>
  );
  const octaveSelect = (octaves: number[]) => (
    <Select
      label={t("drone.octave")}
      selectedKey={String(octave)}
      onSelectionChange={(k) => setOctave(Number(k))}
    >
      {octaves.map((o) => (
        <SelectItem key={o} id={String(o)}>
          {String(o)}
        </SelectItem>
      ))}
    </Select>
  );
  const volumeSlider = (
    <Slider
      label={t("drone.volume")}
      minValue={0}
      maxValue={1}
      step={0.05}
      value={volume}
      onChange={setVolume}
      format={(v) => `${Math.round(v * 100)}%`}
    />
  );
  const startBtn = (
    <button
      type="button"
      className={`${shared.btnMagenta} ${s.start}`}
      onClick={toggle}
      style={playing ? { background: "var(--accent-strong)" } : undefined}
    >
      {playing ? t("drone.stop") : t("drone.play")}
    </button>
  );

  const scaleNotes = (SCALES[scale] ?? SCALES.major).map((o, i) => ({
    name: NOTE_NAMES[(note + o) % 12],
    degree: i + 1,
  }));

  const dockClass = [s.dock, "no-print", open && s.open, playing && s.live].filter(Boolean).join(" ");

  return (
    <>
      <div className={dockClass}>
        <div className={s.tab}>
          <button
            type="button"
            className={s.tabExpand}
            onClick={() => openScreen(SCREEN_ID)}
            aria-label={`${t("screen.expand")} — ${t("drone.name")}`}
          >
            <ArrowsOut size={16} aria-hidden />
          </button>
          <button
            type="button"
            className={s.tabToggle}
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-label={open ? t("drone.hide") : t("drone.show")}
          >
            <Waveform size={22} aria-hidden />
            <span className={s.tabLabel}>{t("drone.name")}</span>
            <span className={s.tabNote}>{NOTE_NAMES[note]}</span>
          </button>
        </div>

        {!onScreen && (
          <div className={s.card}>
            <div className={s.head}>
              <Waveform size={18} aria-hidden />
              <span>{t("drone.name")}</span>
            </div>
            <div className={s.row}>
              {noteSelect}
              {octaveSelect(OCTAVES)}
            </div>
            {volumeSlider}
            {startBtn}
          </div>
        )}
      </div>

      {onScreen && (
        <ToolScreen title={t("drone.name")} icon={Waveform} accent="--s-gold-strong" onClose={closeScreen}>
          <div className={s.row}>
            {noteSelect}
            {octaveSelect(SCREEN_OCTAVES)}
          </div>
          <div className={s.row}>
            <Select
              label={t("drone.chord")}
              selectedKey={chord}
              onSelectionChange={(k) => setChord(String(k))}
            >
              {CHORD_IDS.map((id) => (
                <SelectItem key={id} id={id}>
                  {t(`drone.chords.${id}`)}
                </SelectItem>
              ))}
            </Select>
            <Select
              label={t("drone.timbre")}
              selectedKey={timbre}
              onSelectionChange={(k) => setTimbre(String(k))}
            >
              {TIMBRE_IDS.map((id) => (
                <SelectItem key={id} id={id}>
                  {t(`drone.timbres.${id}`)}
                </SelectItem>
              ))}
            </Select>
          </div>
          {volumeSlider}
          <div className={s.refRow} role="group" aria-label={t("drone.reference")}>
            {A4_OPTIONS.map((hz) => (
              <button
                key={hz}
                type="button"
                className={`${s.refBtn}${a4 === hz ? ` ${s.refBtnOn}` : ""}`}
                aria-pressed={a4 === hz}
                onClick={() => setA4(hz)}
              >
                A={hz}
              </button>
            ))}
          </div>

          <div className={s.scaleBlock}>
            <Select
              label={t("drone.scale")}
              selectedKey={scale}
              onSelectionChange={(k) => setScale(String(k))}
            >
              {SCALE_IDS.map((id) => (
                <SelectItem key={id} id={id}>
                  {t(`drone.scales.${id}`)}
                </SelectItem>
              ))}
            </Select>
            <div className={s.scaleNotes} role="group" aria-label={t("drone.scale")}>
              {scaleNotes.map((n, i) => (
                <span key={i} className={`${s.scaleChip}${i === 0 ? ` ${s.scaleRoot}` : ""}`}>
                  <span className={s.scaleName}>{n.name}</span>
                  <span className={s.scaleDeg}>{n.degree}</span>
                </span>
              ))}
            </div>
          </div>

          {startBtn}
        </ToolScreen>
      )}
    </>
  );
}
