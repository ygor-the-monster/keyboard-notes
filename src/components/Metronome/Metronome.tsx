import { useEffect, useRef, useState } from "react";
import { MetronomeIcon, HandTapIcon as HandTap } from "@phosphor-icons/react";
import { useMetronome } from "./Metronome.hooks.ts";
import { useI18n } from "../../providers/I18nProvider/I18nProvider.tsx";
import { usePref } from "../../providers/StoreProvider/StoreProvider.utils.ts";
import { clamp } from "../../utils/numeric/numeric.ts";
import { Select, SelectItem } from "../fields/Select.tsx";
import { Slider } from "../fields/Slider.tsx";
import shared from "../../providers/ThemeProvider/ThemeProvider.module.css";
import m from "./Metronome.module.css";

// A floating utility dock pinned to the right edge: an agenda-style tab that
// slides the metronome card in and out. Tempo / time signature persist (localStorage).
export default function Metronome({ autostart = false }: { autostart?: boolean }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [bpm, setBpm] = usePref("metro.bpm", 90);
  const [beats, setBeats] = usePref("metro.beats", 4);
  const { running, start, toggle } = useMetronome({ bpm, beats });

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
      </div>
    </div>
  );
}
