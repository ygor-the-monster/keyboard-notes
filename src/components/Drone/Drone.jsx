import { useState } from "react";
import { Picker, PickerItem, Slider } from "@react-spectrum/s2";
import { Waveform } from "@phosphor-icons/react";
import { useI18n } from "../../providers/I18nProvider/I18nProvider.jsx";
import { usePref } from "../../providers/StoreProvider/StoreProvider.utils.ts";
import { useDrone } from "./Drone.hooks.ts";
import { fullWidth } from "./Drone.styled.jsx";
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
          <Picker
            label={t("drone.note")}
            selectedKey={String(note)}
            onSelectionChange={(k) => setNote(Number(k))}
            styles={fullWidth}
          >
            {NOTES.map((n, i) => (
              <PickerItem key={i} id={String(i)}>
                {n}
              </PickerItem>
            ))}
          </Picker>
          <Picker
            label={t("drone.octave")}
            selectedKey={String(octave)}
            onSelectionChange={(k) => setOctave(Number(k))}
            styles={fullWidth}
          >
            {OCTAVES.map((o) => (
              <PickerItem key={o} id={String(o)}>
                {String(o)}
              </PickerItem>
            ))}
          </Picker>
        </div>
        <Slider
          label={t("drone.volume")}
          minValue={0}
          maxValue={1}
          step={0.05}
          value={volume}
          onChange={setVolume}
          styles={fullWidth}
        />
        <button
          type="button"
          className={`${shared.btnMagenta} ${s.start}`}
          onClick={toggle}
          style={playing ? { background: "var(--s-purple-strong)" } : undefined}
        >
          {playing ? t("drone.stop") : t("drone.play")}
        </button>
      </div>
    </div>
  );
}
