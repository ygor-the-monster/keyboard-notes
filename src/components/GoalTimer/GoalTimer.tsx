import { useEffect, useRef, useState } from "react";
import { TimerIcon as Timer, MinusIcon as Minus, PlusIcon as Plus } from "@phosphor-icons/react";
import { useStore } from "../../providers/StoreProvider/StoreProvider.tsx";
import { useI18n } from "../../providers/I18nProvider/I18nProvider.tsx";
import { getPref, setPref, usePref } from "../../providers/StoreProvider/StoreProvider.utils.ts";
import { clamp } from "../../utils/numeric/numeric.ts";
import s from "./GoalTimer.module.css";

// A lesson-level practice utility — a stopwatch toward a daily goal. Styled neutral (silver), since
// it's a tool, not content (the app's "utilities are desaturated, content is chromatic" rule). The
// goal target is a global preference; elapsed time accumulates per lesson in localStorage.
const fmt = (sec: number) =>
  `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, "0")}`;

export default function GoalTimer() {
  const { activeLesson } = useStore();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [target, setTarget] = usePref("goal.target", 20); // minutes, global
  const [elapsed, setElapsed] = useState(0); // accumulated seconds for the active lesson
  const [running, setRunning] = useState(false);
  const startRef = useRef(0); // performance.now() at the last start
  const [, tick] = useState(0); // forces a re-render each second while running

  const id = activeLesson?.id;
  const prefKey = id ? "goal.elapsed." + id : null;

  // Load the lesson's accumulated time whenever the active lesson changes; pause on switch.
  useEffect(() => {
    setElapsed(prefKey ? getPref(prefKey, 0) : 0);
    setRunning(false);
  }, [prefKey]);

  // Re-render once a second while running so the live time updates.
  useEffect(() => {
    if (!running) return;
    const iv = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(iv);
  }, [running]);

  const live = running ? elapsed + (performance.now() - startRef.current) / 1000 : elapsed;
  const goalSec = target * 60;
  const reached = live >= goalSec && goalSec > 0;
  const pct = goalSec > 0 ? clamp((live / goalSec) * 100, 0, 100) : 0;

  function persist(sec: number) {
    setElapsed(sec);
    if (prefKey) setPref(prefKey, sec);
  }
  function toggle() {
    if (running) {
      persist(elapsed + (performance.now() - startRef.current) / 1000);
      setRunning(false);
    } else {
      startRef.current = performance.now();
      setRunning(true);
    }
  }
  function reset() {
    setRunning(false);
    persist(0);
  }
  const bumpTarget = (d: number) => setTarget((m) => clamp(m + d, 5, 180));

  const dockClass = [s.dock, "no-print", open && s.open, running && s.running]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={dockClass}>
      <button
        type="button"
        className={s.tab}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={open ? t("goal.hide") : t("goal.show")}
      >
        <Timer size={22} aria-hidden />
        <span className={s.tabLabel}>{t("goal.name")}</span>
        <span className={s.tabCount}>{Math.floor(live / 60)}m</span>
      </button>

      <div className={s.card}>
        <div className={s.head}>
          <Timer size={18} aria-hidden />
          <span>{t("goal.title")}</span>
        </div>

        <div className={`${s.time} ${reached ? s.reachedTime : ""}`}>{fmt(live)}</div>
        <div className={s.bar} role="presentation">
          <div className={s.barFill} style={{ width: `${pct}%` }} />
        </div>
        {reached && <div className={s.reached}>{t("goal.reached")}</div>}

        <div className={s.controls}>
          <button type="button" className={s.primary} onClick={toggle} disabled={!activeLesson}>
            {running ? t("goal.pause") : t("goal.start")}
          </button>
          <button
            type="button"
            className={s.secondary}
            onClick={reset}
            disabled={!activeLesson || live === 0}
          >
            {t("goal.reset")}
          </button>
        </div>

        <div className={s.goalRow}>
          <span className={s.goalLabel}>{t("goal.goal")}</span>
          <button
            type="button"
            className={s.step}
            onClick={() => bumpTarget(-5)}
            aria-label={`${t("goal.goal")} −5 ${t("goal.minutes")}`}
          >
            <Minus size={14} aria-hidden />
          </button>
          <span className={s.goalValue}>
            {target} {t("goal.minutes")}
          </span>
          <button
            type="button"
            className={s.step}
            onClick={() => bumpTarget(5)}
            aria-label={`${t("goal.goal")} +5 ${t("goal.minutes")}`}
          >
            <Plus size={14} aria-hidden />
          </button>
        </div>
      </div>
    </div>
  );
}
