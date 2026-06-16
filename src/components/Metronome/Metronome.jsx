import { useState } from "react";
import { Slider, Picker, PickerItem } from "@react-spectrum/s2";
import { Metronome as MetronomeIcon } from "@phosphor-icons/react";
import { useMetronome } from "./Metronome.hooks.js";
import { fullWidth } from "./Metronome.styled.jsx";
import shared from "../../providers/ThemeProvider/ThemeProvider.module.css";
import m from "./Metronome.module.css";

// A floating utility dock pinned to the right edge: an agenda-style tab that
// slides the metronome card in and out.
export default function Metronome() {
  const [open, setOpen] = useState(false);
  const [bpm, setBpm] = useState(90);
  const [beats, setBeats] = useState(4);
  const { running, toggle } = useMetronome({ bpm, beats });

  const dockClass = [m.metroDock, "no-print", open && m.open, running && m.running]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={dockClass}>
      <button
        type="button"
        className={m.metroTab}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={open ? "Hide metronome" : "Show metronome"}
      >
        <MetronomeIcon size={22} aria-hidden />
        <span className={m.metroTabLabel}>Metronome</span>
        <span className={m.metroTabBpm}>{bpm}</span>
      </button>

      <div className={m.metroCard}>
        <div className={m.metroHead}>
          <MetronomeIcon size={18} aria-hidden />
          <span>Metronome</span>
        </div>
        <Slider
          label="Tempo"
          minValue={40}
          maxValue={220}
          value={bpm}
          onChange={setBpm}
          styles={fullWidth}
        />
        <Picker
          label="Time signature"
          selectedKey={String(beats)}
          onSelectionChange={(k) => setBeats(Number(k))}
          styles={fullWidth}
        >
          <PickerItem id="4">4/4</PickerItem>
          <PickerItem id="3">3/4</PickerItem>
          <PickerItem id="2">2/4</PickerItem>
          <PickerItem id="6">6/8</PickerItem>
        </Picker>
        <button
          type="button"
          className={`${shared.btnMagenta} ${m.metroStart}`}
          onClick={toggle}
          style={running ? { background: "var(--s-magenta)" } : undefined}
        >
          {running ? "Stop" : "Start"}
        </button>
      </div>
    </div>
  );
}
