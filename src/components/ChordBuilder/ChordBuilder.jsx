import { useRef, useState } from "react";
import { PianoKeysIcon as PianoKeys, XIcon as X } from "@phosphor-icons/react";
import { useI18n } from "../../providers/I18nProvider/I18nProvider.tsx";
import { identifyChord } from "./ChordBuilder.utils.js";
import s from "./ChordBuilder.module.css";

const NOTES = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];
// White keys (pitch class + label) and black keys (pitch class + which white gap it sits after).
const WHITE = [0, 2, 4, 5, 7, 9, 11];
const BLACK = [
  [0, 1],
  [1, 3],
  [3, 6],
  [4, 8],
  [5, 10],
];

// Notes are stored as absolute semitones (pitch class + 12·octave). The keyboard spans one
// octave; tapping a key repeatedly in quick succession picks the octave: 1 tap = middle,
// 2 = an octave up, 3 = an octave down. This lets the bass note set the inversion (slash chord).
const OCT = { mid: 12, up: 24, down: 0 };
const octForTap = (n) => (n === 2 ? OCT.up : n >= 3 ? OCT.down : OCT.mid);
const TAP_WINDOW = 450; // ms within which repeated taps on the same key count as one gesture

export default function ChordBuilder() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState(() => new Set());
  const tapRef = useRef({ pc: -1, t: -Infinity, n: 0 });

  // Each key holds at most one note; rapid re-taps move it between octaves. A lone tap on a
  // key that's already at the middle octave clears it.
  const press = (pc, ts) => {
    const r = tapRef.current;
    const within = pc === r.pc && ts - r.t < TAP_WINDOW;
    const n = within ? r.n + 1 : 1;
    tapRef.current = { pc, t: ts, n };
    const oct = octForTap(n);
    setSel((prev) => {
      const next = new Set(prev);
      let had = -1;
      for (const o of Object.values(OCT))
        if (next.has(pc + o)) {
          had = o;
          next.delete(pc + o);
        }
      // Fresh single tap on a key already sitting at the middle octave → deselect it.
      if (!(!within && had === oct)) next.add(pc + oct);
      return next;
    });
  };

  // Which octave (if any) a key currently sits at — for the highlight + badge.
  const octOf = (pc) =>
    sel.has(pc + OCT.up)
      ? OCT.up
      : sel.has(pc + OCT.down)
        ? OCT.down
        : sel.has(pc + OCT.mid)
          ? OCT.mid
          : -1;

  const chord = identifyChord(sel);
  const dockClass = [s.dock, "no-print", open && s.open].filter(Boolean).join(" ");

  const wW = 34;
  const wH = 108;
  const bw = 20;
  const bh = 66;
  const W = wW * WHITE.length;

  return (
    <div className={dockClass}>
      <button
        type="button"
        className={s.tab}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={open ? t("visual.hide") : t("visual.show")}
      >
        <PianoKeys size={22} aria-hidden />
        <span className={s.tabLabel}>{t("visual.name")}</span>
        {sel.size > 0 && <span className={s.tabChord}>{chord}</span>}
      </button>

      <div className={s.card}>
        <div className={s.head}>
          <PianoKeys size={18} aria-hidden />
          <span>{t("visual.name")}</span>
        </div>

        <div className={s.readout}>
          {sel.size ? (
            <span className={s.chord}>{chord}</span>
          ) : (
            <span className={s.hint}>{t("visual.empty")}</span>
          )}
          {sel.size > 0 && (
            <button type="button" className={s.clear} onClick={() => setSel(new Set())}>
              <X size={14} aria-hidden /> {t("visual.clear")}
            </button>
          )}
        </div>

        <svg
          viewBox={`0 0 ${W} ${wH + 20}`}
          className={s.kbd}
          role="group"
          aria-label={t("visual.name")}
        >
          {WHITE.map((pc, i) => {
            const oct = octOf(pc);
            return (
              <g key={pc}>
                <rect
                  x={i * wW + 0.5}
                  y={0.5}
                  width={wW - 1}
                  height={wH}
                  rx={3}
                  className={oct >= 0 ? s.whiteOn : s.white}
                  onPointerDown={(e) => press(pc, e.timeStamp)}
                />
                {oct === OCT.up && (
                  <text x={i * wW + wW / 2} y={16} textAnchor="middle" className={s.octUp}>
                    ▲
                  </text>
                )}
                {oct === OCT.down && (
                  <text x={i * wW + wW / 2} y={16} textAnchor="middle" className={s.octDown}>
                    ▼
                  </text>
                )}
                <text x={i * wW + wW / 2} y={wH + 15} textAnchor="middle" className={s.label}>
                  {NOTES[pc]}
                </text>
              </g>
            );
          })}
          {BLACK.map(([wi, pc]) => {
            const oct = octOf(pc);
            const x = (wi + 1) * wW - bw / 2;
            return (
              <g key={pc}>
                <rect
                  x={x}
                  y={0}
                  width={bw}
                  height={bh}
                  rx={2}
                  className={oct >= 0 ? s.blackOn : s.black}
                  onPointerDown={(e) => press(pc, e.timeStamp)}
                />
                {oct === OCT.up && (
                  <text x={x + bw / 2} y={15} textAnchor="middle" className={s.octUpDark}>
                    ▲
                  </text>
                )}
                {oct === OCT.down && (
                  <text x={x + bw / 2} y={15} textAnchor="middle" className={s.octDownDark}>
                    ▼
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        <p className={s.octHint}>{t("visual.octaveHint")}</p>
      </div>
    </div>
  );
}
