import { useRef, useState } from "react";
import { Slider, Picker, PickerItem } from "@react-spectrum/s2";
import { Metronome as MetronomeIcon, HandTap } from "@phosphor-icons/react";
import { useMetronome } from "./Metronome.hooks.ts";
import { useI18n } from "../../providers/I18nProvider/I18nProvider.jsx";
import { usePref } from "../../providers/StoreProvider/StoreProvider.utils.ts";
import { fullWidth } from "./Metronome.styled.jsx";
import shared from "../../providers/ThemeProvider/ThemeProvider.module.css";
import m from "./Metronome.module.css";

// A floating utility dock pinned to the right edge: an agenda-style tab that
// slides the metronome card in and out. Tempo / time signature persist (localStorage).
export default function Metronome() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [bpm, setBpm] = usePref("metro.bpm", 90);
  const [beats, setBeats] = usePref("metro.beats", 4);
  const { running, toggle } = useMetronome({ bpm, beats });

  // Tap tempo — average the intervals of recent taps; a gap > 2s starts a fresh count.
  const tapsRef = useRef([]);
  function tap() {
    const now = performance.now();
    const taps = tapsRef.current.filter((t0) => now - t0 < 2000);
    taps.push(now);
    tapsRef.current = taps;
    if (taps.length >= 2) {
      const avg = (taps[taps.length - 1] - taps[0]) / (taps.length - 1);
      setBpm(Math.max(40, Math.min(220, Math.round(60000 / avg))));
    }
  }

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
        aria-label={open ? t("metronome.hide") : t("metronome.show")}
      >
        <MetronomeIcon size={22} aria-hidden />
        <span className={m.metroTabLabel}>{t("metronome.name")}</span>
        <span className={m.metroTabBpm}>{bpm}</span>
      </button>

      <div className={m.metroCard}>
        <div className={m.metroHead}>
          <MetronomeIcon size={18} aria-hidden />
          <span>{t("metronome.name")}</span>
        </div>
        <Slider
          label={t("metronome.tempo")}
          minValue={40}
          maxValue={220}
          value={bpm}
          onChange={setBpm}
          styles={fullWidth}
        />
        <Picker
          label={t("metronome.timeSignature")}
          selectedKey={String(beats)}
          onSelectionChange={(k) => setBeats(Number(k))}
          styles={fullWidth}
        >
          <PickerItem id="4">4/4</PickerItem>
          <PickerItem id="3">3/4</PickerItem>
          <PickerItem id="2">2/4</PickerItem>
          <PickerItem id="6">6/8</PickerItem>
        </Picker>
        <div className={m.metroButtons}>
          <button type="button" className={m.metroTap} onClick={tap}>
            <HandTap size={18} aria-hidden />
            {t("metronome.tap")}
          </button>
          <button
            type="button"
            className={`${shared.btnMagenta} ${m.metroStart}`}
            onClick={toggle}
            style={running ? { background: "var(--s-seafoam-strong)" } : undefined}
          >
            {running ? t("metronome.stop") : t("metronome.start")}
          </button>
        </div>
      </div>
    </div>
  );
}
