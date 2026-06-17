import { useEffect, useRef, useState } from "react";
import { Picker, PickerItem, Slider } from "@react-spectrum/s2";
import { Waveform } from "@phosphor-icons/react";
import { useI18n } from "../../providers/I18nProvider/I18nProvider.jsx";
import { usePref } from "../../providers/StoreProvider/StoreProvider.utils.js";
import { fullWidth } from "./Drone.styled.jsx";
import shared from "../../providers/ThemeProvider/ThemeProvider.module.css";
import s from "./Drone.module.css";

// Sustained reference pitch (drone) for intonation / ear-training. A single oscillator
// through a gain node; note + octave set the frequency, with click-free gain ramps.
const NOTES = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];
const OCTAVES = [2, 3, 4, 5];

const freqOf = (noteIdx, octave) => 440 * 2 ** (((octave + 1) * 12 + noteIdx - 69) / 12);

export default function Drone() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [note, setNote] = usePref("drone.note", 9); // A
  const [octave, setOctave] = usePref("drone.octave", 3);
  const [volume, setVolume] = usePref("drone.volume", 0.3);

  const ctxRef = useRef(null);
  const oscRef = useRef(null);
  const gainRef = useRef(null);

  function ensureCtx() {
    if (!ctxRef.current) ctxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    return ctxRef.current;
  }

  function start() {
    const ctx = ensureCtx();
    ctx.resume?.();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.value = freqOf(note, octave);
    gain.gain.value = 0;
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    gain.gain.linearRampToValueAtTime(volume, ctx.currentTime + 0.05);
    oscRef.current = osc;
    gainRef.current = gain;
    setPlaying(true);
  }
  function stop() {
    const ctx = ctxRef.current;
    const osc = oscRef.current;
    const gain = gainRef.current;
    if (ctx && osc && gain) {
      gain.gain.cancelScheduledValues(ctx.currentTime);
      gain.gain.setValueAtTime(gain.gain.value, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.08);
      osc.stop(ctx.currentTime + 0.1);
    }
    oscRef.current = null;
    gainRef.current = null;
    setPlaying(false);
  }
  const toggle = () => (playing ? stop() : start());

  // Live-update frequency / volume while sounding.
  useEffect(() => {
    const ctx = ctxRef.current;
    if (playing && oscRef.current && ctx) {
      oscRef.current.frequency.setTargetAtTime(freqOf(note, octave), ctx.currentTime, 0.02);
    }
  }, [note, octave, playing]);
  useEffect(() => {
    const ctx = ctxRef.current;
    if (playing && gainRef.current && ctx) {
      gainRef.current.gain.setTargetAtTime(volume, ctx.currentTime, 0.02);
    }
  }, [volume, playing]);

  // Stop the tone on unmount.
  useEffect(() => () => oscRef.current?.stop?.(), []);

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
