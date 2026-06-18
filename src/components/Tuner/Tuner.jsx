import { MusicNote } from "@phosphor-icons/react";
import { useTuner } from "./Tuner.hooks.js";
import { useI18n } from "../../providers/I18nProvider/I18nProvider.tsx";
import { usePref } from "../../providers/StoreProvider/StoreProvider.utils.ts";
import shared from "../../providers/ThemeProvider/ThemeProvider.module.css";
import { useState } from "react";
import t from "./Tuner.module.css";

const A4_OPTIONS = [440, 442];

// A floating utility dock (mirrors the Metronome): an agenda tab that slides a live
// note-identifier card in/out. Detects pitch from the mic and names the note + cents.
export default function Tuner() {
  const { t: tr } = useI18n();
  const [open, setOpen] = useState(false);
  const [a4, setA4] = usePref("tuner.a4", 440);
  const { listening, reading, toggle } = useTuner(a4);

  const dockClass = [t.dock, "no-print", open && t.open, listening && t.live]
    .filter(Boolean)
    .join(" ");
  const inTune = reading && Math.abs(reading.cents) <= 5;

  return (
    <div className={dockClass}>
      <button
        type="button"
        className={t.tab}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={open ? tr("tuner.hide") : tr("tuner.show")}
      >
        <MusicNote size={22} aria-hidden />
        <span className={t.tabLabel}>{tr("tuner.name")}</span>
        <span className={t.tabNote}>{reading ? reading.note : "–"}</span>
      </button>

      <div className={t.card}>
        <div className={t.head}>
          <MusicNote size={18} aria-hidden />
          <span>{tr("tuner.noteIdentifier")}</span>
        </div>

        <div className={`${t.readout}${inTune ? ` ${t.inTune}` : ""}`}>
          <span className={t.note}>
            {reading ? reading.note : "—"}
            {reading && <sub className={t.octave}>{reading.octave}</sub>}
          </span>
          <span className={t.hz}>
            {reading ? `${reading.hz} Hz` : listening ? tr("tuner.listening") : "—"}
          </span>
        </div>

        {/* cents meter: needle relative to centre (in tune within ±5¢) */}
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

        {/* Reference pitch — A=440 (standard) vs A=442 (common orchestral). */}
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

        <button
          type="button"
          className={`${shared.btnMagenta} ${t.start}`}
          onClick={toggle}
          style={listening ? { background: "var(--s-gold-strong)" } : undefined}
        >
          {listening ? tr("tuner.stop") : tr("tuner.startListening")}
        </button>
      </div>
    </div>
  );
}
