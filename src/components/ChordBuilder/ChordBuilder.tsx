import { useRef, useState } from "react";
import {
  PianoKeysIcon as PianoKeys,
  XIcon as X,
  ArrowsOutSimpleIcon as ArrowsOut,
} from "@phosphor-icons/react";
import { useI18n } from "../../providers/I18nProvider/I18nProvider.tsx";
import { useRoute } from "../../providers/RouteProvider/RouteProvider.tsx";
import { NOTE_NAMES } from "../../utils/pitch/pitch.ts";
import {
  identifyChord,
  analyzeChord,
  QUALITIES,
  chordPcs,
  fingering,
  type Instrument,
} from "./ChordBuilder.utils.ts";
import { Select, SelectItem } from "../fields/Select.tsx";
import ToolScreen from "../ToolScreen/ToolScreen.tsx";
import s from "./ChordBuilder.module.css";

const SCREEN_ID = "chords";
// White keys (pitch class) and black keys (pitch class + which white gap it sits after).
const WHITE = [0, 2, 4, 5, 7, 9, 11];
const BLACK = [
  [0, 1],
  [1, 3],
  [3, 6],
  [4, 8],
  [5, 10],
];
const OCT = { mid: 12, up: 24, down: 0 };
const octForTap = (n: number) => (n === 2 ? OCT.up : n >= 3 ? OCT.down : OCT.mid);
const TAP_WINDOW = 450;

// A small chord fingering diagram (movable shape, transposed by root). null fret = muted, 0 = open.
function FretDiagram({ title, frets }: { title: string; frets: (number | null)[] }) {
  const n = frets.length;
  const fretted = frets.filter((f): f is number => f != null && f > 0);
  const minF = fretted.length ? Math.min(...fretted) : 1;
  // Anchor at the nut when any string is open or the shape sits low; otherwise window from minF.
  const open = frets.some((f) => f === 0) || minF <= 1;
  const base = open ? 1 : minF; // top fret of the 4-fret window
  const ROWS = 4;
  const X0 = 10;
  const step = 14;
  const X1 = X0 + (n - 1) * step;
  const Y0 = 16;
  const rowH = 13;
  const sx = (i: number) => X0 + i * step;
  const fy = (r: number) => Y0 + r * rowH;
  return (
    <div className={s.fret}>
      <span className={s.fretTitle}>{title}</span>
      <svg viewBox={`0 0 ${X1 + 10} ${fy(ROWS) + 6}`} className={s.fretSvg} aria-hidden>
        {open ? (
          <line x1={X0} y1={Y0} x2={X1} y2={Y0} className={s.nut} />
        ) : (
          <text x={2} y={Y0 + rowH - 2} className={s.fretNum}>
            {base}
          </text>
        )}
        {Array.from({ length: ROWS + 1 }, (_, r) => (
          <line key={`f${r}`} x1={X0} y1={fy(r)} x2={X1} y2={fy(r)} className={s.fretLine} />
        ))}
        {frets.map((_, i) => (
          <line key={`s${i}`} x1={sx(i)} y1={Y0} x2={sx(i)} y2={fy(ROWS)} className={s.stringLine} />
        ))}
        {frets.map((f, i) =>
          f == null ? (
            <text key={`m${i}`} x={sx(i)} y={Y0 - 5} textAnchor="middle" className={s.muted}>
              ×
            </text>
          ) : f === 0 ? (
            <circle key={`o${i}`} cx={sx(i)} cy={Y0 - 7} r={2.6} className={s.openDot} />
          ) : (
            <circle key={`d${i}`} cx={sx(i)} cy={fy(f - base) + rowH / 2} r={4} className={s.dot} />
          ),
        )}
      </svg>
    </div>
  );
}

export default function ChordBuilder() {
  const { t } = useI18n();
  const { screen, openScreen, closeScreen } = useRoute();
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState<Set<number>>(() => new Set());
  const [lookupRoot, setLookupRoot] = useState(0);
  const [lookupQuality, setLookupQuality] = useState("maj");
  const tapRef = useRef<{ pc: number; t: number; n: number }>({ pc: -1, t: -Infinity, n: 0 });
  const onScreen = screen === SCREEN_ID;

  const press = (pc: number, ts: number) => {
    const r = tapRef.current;
    const within = pc === r.pc && ts - r.t < TAP_WINDOW;
    const nn = within ? r.n + 1 : 1;
    tapRef.current = { pc, t: ts, n: nn };
    const oct = octForTap(nn);
    setSel((prev) => {
      const next = new Set(prev);
      let had = -1;
      for (const o of Object.values(OCT))
        if (next.has(pc + o)) {
          had = o;
          next.delete(pc + o);
        }
      if (!(!within && had === oct)) next.add(pc + oct);
      return next;
    });
  };

  const octOf = (pc: number) =>
    sel.has(pc + OCT.up)
      ? OCT.up
      : sel.has(pc + OCT.down)
        ? OCT.down
        : sel.has(pc + OCT.mid)
          ? OCT.mid
          : -1;

  // Reverse lookup: pick root + quality → light those notes on the keyboard (drives the same `sel`).
  function lookup(root: number, qualityId: string) {
    setLookupRoot(root);
    setLookupQuality(qualityId);
    const sym = qualityId === "maj" ? "" : qualityId;
    setSel(new Set(chordPcs(root, sym).map((pc) => pc + OCT.mid)));
  }

  const chord = identifyChord(sel);
  const analysis = analyzeChord(sel);
  const dockClass = [s.dock, "no-print", open && s.open].filter(Boolean).join(" ");

  const wW = 34;
  const wH = 108;
  const bw = 20;
  const bh = 66;
  const W = wW * WHITE.length;

  const keyboard = (className: string) => (
    <svg viewBox={`0 0 ${W} ${wH + 20}`} className={className} role="group" aria-label={t("visual.name")}>
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
              {NOTE_NAMES[pc]}
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
  );

  const readout = (
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
  );

  return (
    <>
      <div className={dockClass}>
        <div className={s.tab}>
          <button
            type="button"
            className={s.tabExpand}
            onClick={() => openScreen(SCREEN_ID)}
            aria-label={`${t("screen.expand")} — ${t("visual.name")}`}
          >
            <ArrowsOut size={16} aria-hidden />
          </button>
          <button
            type="button"
            className={s.tabToggle}
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-label={open ? t("visual.hide") : t("visual.show")}
          >
            <PianoKeys size={22} aria-hidden />
            <span className={s.tabLabel}>{t("visual.name")}</span>
            {sel.size > 0 && <span className={s.tabChord}>{chord}</span>}
          </button>
        </div>

        {!onScreen && (
          <div className={s.card}>
            <div className={s.head}>
              <PianoKeys size={18} aria-hidden />
              <span>{t("visual.name")}</span>
            </div>
            {readout}
            {keyboard(s.kbd)}
            <p className={s.octHint}>{t("visual.octaveHint")}</p>
          </div>
        )}
      </div>

      {onScreen && (
        <ToolScreen title={t("visual.name")} icon={PianoKeys} accent="--s-seafoam" onClose={closeScreen}>
          {readout}
          {keyboard(s.kbdWide)}
          <p className={s.octHint}>{t("visual.octaveHint")}</p>

          {analysis && (
            <div className={s.spelling} role="group" aria-label={t("visual.spelling")}>
              {analysis.tones.map((tone) => (
                <span key={tone.pc} className={s.toneChip}>
                  <span className={s.toneName}>{tone.name}</span>
                  <span className={s.toneDeg}>{tone.tone}</span>
                </span>
              ))}
            </div>
          )}

          <div className={s.lookup}>
            <span className={s.fieldLabel}>{t("visual.lookup")}</span>
            <div className={s.lookupRow}>
              <Select
                label={t("visual.root")}
                selectedKey={String(lookupRoot)}
                onSelectionChange={(k) => lookup(Number(k), lookupQuality)}
              >
                {NOTE_NAMES.map((n, i) => (
                  <SelectItem key={i} id={String(i)}>
                    {n}
                  </SelectItem>
                ))}
              </Select>
              <Select
                label={t("visual.quality")}
                selectedKey={lookupQuality}
                onSelectionChange={(k) => lookup(lookupRoot, String(k))}
              >
                {QUALITIES.map((q) => (
                  <SelectItem key={q.id} id={q.id}>
                    {q.id}
                  </SelectItem>
                ))}
              </Select>
            </div>
          </div>

          {analysis?.sym != null && (
            <div className={s.frets}>
              {(["guitar", "ukulele"] as Instrument[]).map((inst) => {
                const f = fingering(analysis.rootPc, analysis.sym ?? "", inst);
                return f ? (
                  <FretDiagram key={inst} title={t(`tuner.instrument.${inst}`)} frets={f} />
                ) : (
                  <div key={inst} className={s.fret}>
                    <span className={s.fretTitle}>{t(`tuner.instrument.${inst}`)}</span>
                    <span className={s.noShape}>{t("visual.noShape")}</span>
                  </div>
                );
              })}
            </div>
          )}
        </ToolScreen>
      )}
    </>
  );
}
