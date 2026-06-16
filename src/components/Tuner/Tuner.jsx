import { MusicNote } from "@phosphor-icons/react";
import { useTuner } from "./Tuner.hooks.js";
import shared from "../../providers/ThemeProvider/ThemeProvider.module.css";
import { useState } from "react";
import t from "./Tuner.module.css";

// A floating utility dock (mirrors the Metronome): an agenda tab that slides a live
// note-identifier card in/out. Detects pitch from the mic and names the note + cents.
export default function Tuner() {
  const [open, setOpen] = useState(false);
  const { listening, reading, toggle } = useTuner();

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
        aria-label={open ? "Hide tuner" : "Show tuner"}
      >
        <MusicNote size={22} aria-hidden />
        <span className={t.tabLabel}>Tuner</span>
        <span className={t.tabNote}>{reading ? reading.note : "–"}</span>
      </button>

      <div className={t.card}>
        <div className={t.head}>
          <MusicNote size={18} aria-hidden />
          <span>Note identifier</span>
        </div>

        <div className={`${t.readout}${inTune ? ` ${t.inTune}` : ""}`}>
          <span className={t.note}>
            {reading ? reading.note : "—"}
            {reading && <sub className={t.octave}>{reading.octave}</sub>}
          </span>
          <span className={t.hz}>
            {reading ? `${reading.hz} Hz` : listening ? "Listening…" : "—"}
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
          <span>♭ flat</span>
          <span>{reading ? `${reading.cents > 0 ? "+" : ""}${reading.cents}¢` : ""}</span>
          <span>sharp ♯</span>
        </div>

        <button
          type="button"
          className={`${shared.btnMagenta} ${t.start}`}
          onClick={toggle}
          style={listening ? { background: "var(--s-purple)" } : undefined}
        >
          {listening ? "Stop" : "Start listening"}
        </button>
      </div>
    </div>
  );
}
