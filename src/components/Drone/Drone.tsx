import { useState } from "react";
import { WaveformIcon as Waveform } from "@phosphor-icons/react";
import { useI18n } from "../../providers/I18nProvider/I18nProvider.tsx";
import { usePref } from "../../providers/StoreProvider/StoreProvider.utils.ts";
import { useDrone } from "./Drone.hooks.ts";
import { Select, SelectItem } from "../fields/Select.tsx";
import { Slider } from "../fields/Slider.tsx";
import shared from "../../providers/ThemeProvider/ThemeProvider.module.css";
import s from "./Drone.module.css";

// Sustained reference pitch (drone) for intonation / ear-training. UI only — the oscillator and
// its click-free gain ramps live in useDrone + the shared audio engine.
const NOTES = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];
const OCTAVES = [2, 3, 4, 5];

export default function Drone() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [note, setNote] = usePref("drone.note", 9); // A
  const [octave, setOctave] = usePref("drone.octave", 3);
  const [volume, setVolume] = usePref("drone.volume", 0.3);
  const { playing, toggle } = useDrone({ note, octave, volume });

  const dockClass = [s.dock, "no-print", open && s.open, playing && s.live]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={dockClass}>
      <button
        type="button"
        className={s.tab}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={open ? t("drone.hide") : t("drone.show")}
      >
        <Waveform size={22} aria-hidden />
        <span className={s.tabLabel}>{t("drone.name")}</span>
        <span className={s.tabNote}>{NOTES[note]}</span>
      </button>

      <div className={s.card}>
        <div className={s.head}>
          <Waveform size={18} aria-hidden />
          <span>{t("drone.name")}</span>
        </div>
        <div className={s.row}>
          <Select
            label={t("drone.note")}
            selectedKey={String(note)}
            onSelectionChange={(k) => setNote(Number(k))}
          >
            {NOTES.map((n, i) => (
              <SelectItem key={i} id={String(i)}>
                {n}
              </SelectItem>
            ))}
          </Select>
          <Select
            label={t("drone.octave")}
            selectedKey={String(octave)}
            onSelectionChange={(k) => setOctave(Number(k))}
          >
            {OCTAVES.map((o) => (
              <SelectItem key={o} id={String(o)}>
                {String(o)}
              </SelectItem>
            ))}
          </Select>
        </div>
        <Slider
          label={t("drone.volume")}
          minValue={0}
          maxValue={1}
          step={0.05}
          value={volume}
          onChange={setVolume}
          format={(v) => `${Math.round(v * 100)}%`}
        />
        <button
          type="button"
          className={`${shared.btnMagenta} ${s.start}`}
          onClick={toggle}
          style={playing ? { background: "var(--accent-strong)" } : undefined}
        >
          {playing ? t("drone.stop") : t("drone.play")}
        </button>
      </div>
    </div>
  );
}
