import { useEffect, useRef, useState } from "react";
import {
  TimerIcon as Timer,
  MinusIcon as Minus,
  PlusIcon as Plus,
  ArrowsOutSimpleIcon as ArrowsOut,
  FlameIcon as Flame,
} from "@phosphor-icons/react";
import { useI18n } from "../../providers/I18nProvider/I18nProvider.tsx";
import { useRoute } from "../../providers/RouteProvider/RouteProvider.tsx";
import { getPref, setPref, usePref } from "../../providers/StoreProvider/StoreProvider.utils.ts";
import { clamp } from "../../utils/numeric/numeric.ts";
import ToolScreen from "../ToolScreen/ToolScreen.tsx";
import s from "./GoalTimer.module.css";

const SCREEN_ID = "practice";
const HISTORY_DAYS = 14;
const LOG_KEY = "goal.log"; // { "YYYY-MM-DD": seconds } — daily practice totals, across all lessons

const fmt = (sec: number) =>
  `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, "0")}`;
const dayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const today = () => dayKey(new Date());
const dayAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return dayKey(d);
};

// A daily practice stopwatch toward a goal — global, not per-lesson (the goal is a daily habit).
// Styled neutral (silver), since it's a tool, not content. Time accumulates into a per-day log in
// localStorage; the expanded screen adds a streak and a 14-day history.
export default function GoalTimer() {
  const { t } = useI18n();
  const { screen, openScreen, closeScreen } = useRoute();
  const [open, setOpen] = useState(false);
  const [target, setTarget] = usePref("goal.target", 20); // minutes/day, global
  const [log, setLog] = useState<Record<string, number>>(() => getPref(LOG_KEY, {}));
  const [running, setRunning] = useState(false);
  const startRef = useRef(0); // performance.now() at the last start
  const [, tick] = useState(0); // forces a re-render each second while running
  const onScreen = screen === SCREEN_ID;

  const td = today();
  const committed = log[td] ?? 0;

  useEffect(() => {
    if (!running) return;
    const iv = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(iv);
  }, [running]);

  const live = running ? committed + (performance.now() - startRef.current) / 1000 : committed;
  const goalSec = target * 60;
  const reached = live >= goalSec && goalSec > 0;
  const pct = goalSec > 0 ? clamp((live / goalSec) * 100, 0, 100) : 0;

  function persist(next: Record<string, number>) {
    setLog(next);
    setPref(LOG_KEY, next);
  }
  function toggle() {
    if (running) {
      persist({ ...log, [td]: committed + (performance.now() - startRef.current) / 1000 });
      setRunning(false);
    } else {
      startRef.current = performance.now();
      setRunning(true);
    }
  }
  function reset() {
    setRunning(false);
    persist({ ...log, [td]: 0 });
  }
  const bumpTarget = (d: number) => setTarget((m) => clamp(m + d, 5, 180));

  // Streak: consecutive days meeting the goal, counting today only once it's met.
  let streak = 0;
  if (goalSec > 0) {
    for (let d = live >= goalSec ? 0 : 1; d < 400; d++) {
      const sec = d === 0 ? live : (log[dayAgo(d)] ?? 0);
      if (sec >= goalSec) streak++;
      else break;
    }
  }

  // 14-day history (oldest → today); today reflects the live time.
  const history = Array.from({ length: HISTORY_DAYS }, (_, i) => {
    const n = HISTORY_DAYS - 1 - i;
    const sec = n === 0 ? live : (log[dayAgo(n)] ?? 0);
    return { sec, met: goalSec > 0 && sec >= goalSec, isToday: n === 0 };
  });

  const timeBlock = (
    <>
      <div className={`${s.time} ${reached ? s.reachedTime : ""}`}>{fmt(live)}</div>
      <div className={s.bar} role="presentation">
        <div className={s.barFill} style={{ width: `${pct}%` }} />
      </div>
      {reached && <div className={s.reached}>{t("goal.reached")}</div>}
      <div className={s.controls}>
        <button type="button" className={s.primary} onClick={toggle}>
          {running ? t("goal.pause") : t("goal.start")}
        </button>
        <button type="button" className={s.secondary} onClick={reset} disabled={live === 0}>
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
    </>
  );

  const dockClass = [s.dock, "no-print", open && s.open, running && s.running]
    .filter(Boolean)
    .join(" ");

  return (
    <>
      <div className={dockClass}>
        <div className={s.tab}>
          <button
            type="button"
            className={s.tabExpand}
            onClick={() => openScreen(SCREEN_ID)}
            aria-label={`${t("screen.expand")} — ${t("goal.name")}`}
          >
            <ArrowsOut size={16} aria-hidden />
          </button>
          <button
            type="button"
            className={s.tabToggle}
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-label={open ? t("goal.hide") : t("goal.show")}
          >
            <Timer size={22} aria-hidden />
            <span className={s.tabLabel}>{t("goal.name")}</span>
            <span className={s.tabCount}>{Math.floor(live / 60)}m</span>
          </button>
        </div>

        {!onScreen && (
          <div className={s.card}>
            <div className={s.head}>
              <Timer size={18} aria-hidden />
              <span>{t("goal.title")}</span>
            </div>
            {timeBlock}
          </div>
        )}
      </div>

      {onScreen && (
        <ToolScreen title={t("goal.title")} icon={Timer} accent="--s-silver-strong" onClose={closeScreen}>
          {timeBlock}

          <div className={s.streak}>
            <Flame size={22} weight="fill" aria-hidden className={streak > 0 ? s.streakOn : s.streakOff} />
            <span className={s.streakNum}>{streak}</span>
            <span className={s.streakLabel}>{t("goal.streak")}</span>
          </div>

          <div className={s.historyBlock}>
            <span className={s.fieldLabel}>{t("goal.history")}</span>
            <div className={s.history} role="group" aria-label={t("goal.history")}>
              {history.map((d, i) => (
                <span
                  key={i}
                  className={`${s.histBar}${d.isToday ? ` ${s.histToday}` : ""}`}
                  title={`${Math.round(d.sec / 60)} ${t("goal.minutes")}`}
                >
                  <span
                    className={`${s.histFill}${d.met ? ` ${s.histMet}` : ""}`}
                    style={{ height: `${goalSec > 0 ? clamp((d.sec / goalSec) * 100, 0, 100) : 0}%` }}
                  />
                </span>
              ))}
            </div>
          </div>
        </ToolScreen>
      )}
    </>
  );
}
