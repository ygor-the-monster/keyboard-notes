import { useEffect, useRef, useState } from "react";
import {
  PlayIcon as Play,
  StopIcon as Stop,
  ShuffleSimpleIcon as ShuffleSimple,
  ShuffleAngularIcon as ShuffleAngular,
  ArrowUpRightIcon as ArrowUpRight,
  ArrowDownRightIcon as ArrowDownRight,
  ArrowUpIcon as ArrowUp,
  ArrowDownIcon as ArrowDown,
  ArrowLeftIcon as ArrowLeft,
  ArrowRightIcon as ArrowRight,
  ArrowsOutCardinalIcon as ArrowsOutCardinal,
  TextTIcon as TextT,
  ArrowsOutLineHorizontalIcon as ArrowsOutLineHorizontal,
  HashIcon as Hash,
  SplitHorizontalIcon as SplitHorizontal,
  FlowArrowIcon as FlowArrow,
  CirclesThreeIcon as CirclesThree,
  PianoKeysIcon as PianoKeys,
  SpeakerSimpleNoneIcon as SpeakerSimpleNone,
  LineVerticalIcon as LineVertical,
  VibrateIcon as Vibrate,
  BatteryVerticalFullIcon as BatteryVerticalFull,
  BatteryVerticalEmptyIcon as BatteryVerticalEmpty,
  MusicNoteSimpleIcon as MusicNoteSimple,
  WaveformIcon as Waveform,
  HandIcon as Hand,
  FootprintsIcon as Footprints,
  PlusSquareIcon as PlusSquare,
  MinusSquareIcon as MinusSquare,
  UserSoundIcon as UserSound,
} from "@phosphor-icons/react";
import { useStore } from "../../providers/StoreProvider/StoreProvider.tsx";
import { useI18n } from "../../providers/I18nProvider/I18nProvider.tsx";
import EmptyState from "../EmptyState/EmptyState.tsx";
import {
  getAbcjs,
  splitAbc,
  joinAbc,
  cleanAbc,
  addStaff,
  removeStaff,
  staffIds,
  smartNote,
  wrapNotes,
  insertIntoTextarea,
  parseTempo,
  withTempo,
  SMUFL,
} from "./ScoreCell.utils.ts";
import Toolbar from "../Toolbar/Toolbar.tsx";
import type { Tool } from "../Toolbar/Toolbar.tsx";
import type { CellOf } from "../../cells/kinds.ts";
import shared from "../../providers/ThemeProvider/ThemeProvider.module.css";
import s from "./ScoreCell.module.css";

// New cells store header/body separately; legacy cells split `source`.
function readHB(cell: { header?: string | null; body?: string | null; source?: string }) {
  if (cell.header != null || cell.body != null) {
    return { header: cell.header || "", body: cell.body || "" };
  }
  return splitAbc(cell.source || "");
}

export default function ScoreCell({ cell, editing }: { cell: CellOf<"score">; editing: boolean }) {
  const { updateCell } = useStore();
  const { t, localizeTools } = useI18n();
  const renderRef = useRef<HTMLDivElement>(null);
  const errRef = useRef<HTMLDivElement>(null);
  const synthRef = useRef<any>(null);
  const headRef = useRef<HTMLTextAreaElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null); // music body — also the palette insertion target
  const [playing, setPlaying] = useState(false);

  const { header, body } = readHB(cell);
  const source = joinAbc(header, body);

  useEffect(() => {
    if (!renderRef.current) return;
    let cancelled = false;
    (async () => {
      const abcjs = await getAbcjs();
      if (cancelled || !renderRef.current) return;
      if (errRef.current) errRef.current.textContent = "";
      try {
        abcjs.renderAbc(renderRef.current, "%%stretchlast 1\n" + cleanAbc(source), {
          responsive: "resize",
          add_classes: true,
        });
      } catch (e) {
        if (errRef.current)
          errRef.current.textContent = t("cell.errNotation", { msg: (e as Error).message });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [source, editing, t]);

  // Uncontrolled editors (native undo); push external changes back into header / body.
  useEffect(() => {
    if (headRef.current && headRef.current.value !== header) headRef.current.value = header;
    if (taRef.current && taRef.current.value !== body) taRef.current.value = body;
  }, [header, body]);

  useEffect(() => () => stop(), []);

  function stop() {
    setPlaying(false);
    if (synthRef.current) {
      try {
        synthRef.current.stop();
      } catch {}
    }
  }
  async function play() {
    const abcjs = await getAbcjs();
    if (!abcjs.synth.supportsAudio()) {
      if (errRef.current) errRef.current.textContent = t("cell.errNoAudio");
      return;
    }
    try {
      stop();
      const host = renderRef.current || document.createElement("div");
      const visual = abcjs.renderAbc(host, cleanAbc(source), { responsive: "resize" })[0];
      const synth = new abcjs.synth.CreateSynth();
      synthRef.current = synth;
      await synth.init({ visualObj: visual, options: { program: 0 } });
      await synth.prime();
      synth.start();
      setPlaying(true);
    } catch (e) {
      if (errRef.current)
        errRef.current.textContent = t("cell.errPlay", { msg: (e as Error).message });
    }
  }

  const setHeader = () => updateCell(cell.id, { header: headRef.current?.value ?? "" });
  const setBody = () => updateCell(cell.id, { body: taRef.current?.value ?? "" });
  const ins = (text: string, back?: number) =>
    insertIntoTextarea(taRef.current, text, back, setBody);
  const headerNow = () => headRef.current?.value ?? header;
  const bodyNow = () => taRef.current?.value ?? body;
  // Score-level edits (add / remove staff) rewrite header + body together; the uncontrolled
  // textareas re-sync from props via the effect above.
  const applyScore = (next: { header?: string; body?: string }) => updateCell(cell.id, next);

  // Smart, caret/selection-aware edits: act on the note at the caret (or selected notes);
  // fall back to a plain insert when the caret isn't on a note.
  const caretRange = () => [taRef.current?.selectionStart ?? 0, taRef.current?.selectionEnd ?? 0];
  const smart = (kind: string, arg: any, fallback: string, back?: number) => {
    const [a, b] = caretRange();
    const nb = smartNote(headerNow(), bodyNow(), a, b, kind, arg);
    if (nb == null) ins(fallback, back);
    else updateCell(cell.id, { body: nb });
  };
  const wrapSel = (kind: string, fallback: string, back?: number) => {
    const [a, b] = caretRange();
    const nb = wrapNotes(headerNow(), bodyNow(), a, b, kind);
    if (nb == null) ins(fallback, back);
    else updateCell(cell.id, { body: nb });
  };
  // Line-level field (e.g. lyrics w:) — drop it on its own new line right after the current
  // line instead of splitting it mid-caret.
  const insLine = (text: string) => {
    const ta = taRef.current;
    if (!ta) return;
    const v = ta.value;
    const eol = v.indexOf("\n", ta.selectionStart ?? v.length);
    const at = eol === -1 ? v.length : eol;
    ta.setSelectionRange(at, at);
    ins("\n" + text);
  };

  const TEMPO_STEP = 2;
  const tempoNow = () => parseTempo(headerNow());
  const setTempo = (bpm: number) =>
    updateCell(cell.id, { header: withTempo(headerNow(), Math.min(220, Math.max(40, bpm))) });

  const staff = <div key="staff" className="abc-render" ref={renderRef} />;
  const err = <div key="err" className="abc-error no-print" ref={errRef} />;

  if (!editing) {
    if (!body.trim()) return <EmptyState kind="score" title={t("cell.emptyScore")} compact />;
    return (
      <div className={s.col}>
        {staff}
        {err}
      </div>
    );
  }

  const note = (n: string) => ({ id: n, char: n, label: `Note ${n}`, onUse: () => ins(n) });
  // Decoration option: inserts an ABC !name! bang-decoration before the next note.
  const deco = (id: string, name: string, glyph: string, label: string) => ({
    id,
    glyph,
    label,
    onUse: () => ins(`!${name}!`),
  });

  // The shared clef list — reused by the "Clef" group (inline change) and the
  // "Add staff" group (new stave). `act(name)` decides what each pick does.
  const CLEFS = [
    { id: "treble", name: "treble", char: "G", label: "Treble" },
    { id: "bass", name: "bass", char: "F", label: "Bass" },
    { id: "alto", name: "alto", char: "C3", label: "Alto" },
    { id: "tenor", name: "tenor", char: "C4", label: "Tenor" },
    { id: "treble8up", name: "treble+8", char: "G+8", label: "Treble +8" },
    { id: "treble8dn", name: "treble-8", char: "G-8", label: "Treble −8" },
    { id: "bass8up", name: "bass+8", char: "F+8", label: "Bass +8" },
    { id: "bass8dn", name: "bass-8", char: "F-8", label: "Bass −8" },
    { id: "none", name: "none", char: "—", label: "No clef" },
    { id: "perc", name: "perc", char: "x", label: "Percussion" },
  ];
  const clefOptions = (act: (name: string) => void, suffix: string) =>
    CLEFS.map((c) => ({
      id: c.id,
      char: c.char,
      label: `${c.label}${suffix}`,
      onUse: () => act(c.name),
    }));

  const tools: Tool[] = [
    {
      kind: "toggle",
      id: "play",
      icon: Play,
      altIcon: Stop,
      label: "Play",
      altLabel: "Stop",
      value: playing,
      onToggle: () => (playing ? stop() : play()),
    },
    {
      kind: "spinner",
      id: "tempo",
      label: "Tempo",
      display: `${tempoNow()} BPM`,
      onPrev: () => setTempo(tempoNow() - TEMPO_STEP),
      onNext: () => setTempo(tempoNow() + TEMPO_STEP),
      prevDisabled: tempoNow() <= 40,
      nextDisabled: tempoNow() >= 220,
    },
    { kind: "sep" },
    {
      kind: "group",
      id: "notes",
      char: "C",
      label: "Notes",
      options: [
        ...["C", "D", "E", "F", "G", "A", "B"].map(note),
        { id: "c", char: "c", label: "Note c (octave up)", onUse: () => ins("c") },
      ],
    },
    {
      kind: "group",
      id: "acc",
      icon: Hash,
      label: "Accidentals",
      options: [
        {
          id: "sharp",
          glyph: SMUFL.sharp,
          label: "Sharp",
          onUse: () => smart("accidental", "^", "^"),
        },
        {
          id: "flat",
          glyph: SMUFL.flat,
          label: "Flat",
          onUse: () => smart("accidental", "_", "_"),
        },
        {
          id: "nat",
          glyph: SMUFL.natural,
          label: "Natural",
          onUse: () => smart("accidental", "=", "="),
        },
      ],
    },
    {
      kind: "group",
      id: "oct",
      icon: ShuffleSimple,
      label: "Octave",
      options: [
        { id: "up", icon: ArrowUpRight, label: "Octave up", onUse: () => smart("octave", 1, "'") },
        {
          id: "down",
          icon: ArrowDownRight,
          label: "Octave down",
          onUse: () => smart("octave", -1, ","),
        },
      ],
    },
    { kind: "sep" },
    {
      kind: "group",
      id: "len",
      icon: SplitHorizontal,
      label: "Length",
      options: [
        {
          id: "whole",
          char: "4",
          label: "Whole note (×4)",
          onUse: () => smart("length", "4", "4"),
        },
        { id: "half", char: "2", label: "Half note (×2)", onUse: () => smart("length", "2", "2") },
        {
          id: "eighth",
          char: "½",
          label: "Eighth note (½)",
          onUse: () => smart("length", "/2", "/2"),
        },
        {
          id: "sixteenth",
          char: "¼",
          label: "Sixteenth note (¼)",
          onUse: () => smart("length", "/4", "/4"),
        },
      ],
    },
    {
      kind: "group",
      id: "rhythm",
      icon: FlowArrow,
      label: "Dotted rhythm",
      options: [
        { id: "dot", char: ">", label: "Dotted — long·short pair", onUse: () => ins(">") },
        { id: "rdot", char: "<", label: "Reverse dotted — short·long pair", onUse: () => ins("<") },
      ],
    },
    {
      kind: "group",
      id: "tup",
      icon: CirclesThree,
      label: "Tuplets",
      options: [
        { id: "t3", char: "3", label: "Triplet", onUse: () => ins("(3") },
        { id: "t2", char: "2", label: "Duplet", onUse: () => ins("(2") },
        { id: "t5", char: "5", label: "Quintuplet", onUse: () => ins("(5") },
        { id: "tg", char: "n", label: "General tuplet — type p:q:r", onUse: () => ins("(") },
      ],
    },
    {
      kind: "group",
      id: "phr",
      icon: PianoKeys,
      label: "Phrasing",
      options: [
        {
          id: "chord",
          char: "[]",
          label: "Chord — wraps selected notes",
          onUse: () => wrapSel("chord", "[]", 1),
        },
        { id: "tie", char: "‿", label: "Tie", onUse: () => ins("-") },
        {
          id: "slur",
          char: "()",
          label: "Slur — wraps selected notes",
          onUse: () => wrapSel("slur", "()", 1),
        },
        {
          id: "grace",
          glyph: SMUFL.grace,
          dy: 0.21,
          label: "Grace notes — type inside",
          onUse: () => ins("{}", 1),
        },
        {
          id: "acci",
          glyph: SMUFL.acciaccatura,
          dy: 0.21,
          label: "Acciaccatura — type note inside",
          onUse: () => ins("{/}", 1),
        },
      ],
    },
    { kind: "sep" },
    {
      kind: "group",
      id: "rests",
      icon: SpeakerSimpleNone,
      label: "Rests",
      options: [
        { id: "z", glyph: SMUFL.restQuarter, label: "Rest (visible)", onUse: () => ins("z") },
        {
          id: "x",
          glyph: SMUFL.restQuarter,
          dim: true,
          label: "Invisible rest",
          onUse: () => ins("x"),
        },
        {
          id: "Z",
          glyph: SMUFL.restDoubleWhole,
          label: "Multi-measure rest",
          onUse: () => ins("Z"),
        },
        {
          id: "y",
          icon: ArrowsOutLineHorizontal,
          label: "Spacer (horizontal space)",
          onUse: () => ins("y"),
        },
      ],
    },
    {
      kind: "group",
      id: "bars",
      icon: LineVertical,
      label: "Bars & repeats",
      options: [
        { id: "bar", char: "|", label: "Bar line", onUse: () => ins(" | ") },
        { id: "dbl", char: "‖", label: "Double bar", onUse: () => ins(" || ") },
        { id: "fin", char: "|]", label: "Final bar", onUse: () => ins(" |] ") },
        { id: "thin", char: "[|", label: "Thick-thin start bar", onUse: () => ins(" [| ") },
        { id: "rs", char: "|:", label: "Repeat start", onUse: () => ins(" |: ") },
        { id: "re", char: ":|", label: "Repeat end", onUse: () => ins(" :| ") },
        { id: "rb", char: "::", label: "Repeat both sides", onUse: () => ins(" :: ") },
        { id: "e1", char: "1", label: "First ending", onUse: () => ins("[1 ") },
        { id: "e2", char: "2", label: "Second ending", onUse: () => ins("[2 ") },
      ],
    },
    {
      kind: "group",
      id: "oshift",
      icon: ShuffleAngular,
      label: "Octave shift",
      options: [
        {
          id: "up",
          icon: ArrowUpRight,
          label: "Octave up (8va) — wraps the passage",
          onUse: () => ins("!8va(!!8va)!", 6),
        },
        {
          id: "down",
          icon: ArrowDownRight,
          label: "Octave down (8vb) — wraps the passage",
          onUse: () => ins("!8vb(!!8vb)!", 6),
        },
      ],
    },
    {
      // Change the clef of the current line, inline.
      kind: "group",
      id: "clef",
      icon: MusicNoteSimple,
      label: "Clef",
      options: clefOptions((name) => ins(`[K:clef=${name}]`), " clef"),
    },
    { kind: "sep" },
    {
      kind: "group",
      id: "orn",
      icon: Waveform,
      label: "Ornaments & articulation",
      options: [
        deco("stac", "staccato", SMUFL.staccato, "Staccato"),
        deco("accent", "accent", SMUFL.accent, "Accent"),
        deco("ten", "tenuto", SMUFL.tenuto, "Tenuto"),
        deco("marc", "marcato", SMUFL.marcato, "Marcato"),
        deco("fer", "fermata", SMUFL.fermata, "Fermata"),
        deco("tr", "trill", SMUFL.trill, "Trill"),
        deco("mor", "mordent", SMUFL.mordent, "Mordent"),
        deco("lmor", "lowermordent", SMUFL.mordentLower, "Lower mordent"),
        deco("turn", "turn", SMUFL.turn, "Turn"),
        deco("iturn", "invertedturn", SMUFL.turnInverted, "Inverted turn"),
      ],
    },
    {
      kind: "group",
      id: "dyn",
      icon: Vibrate,
      label: "Dynamics",
      options: [
        deco("ppp", "ppp", SMUFL.dynPPP, "Pianississimo"),
        deco("pp", "pp", SMUFL.dynPP, "Pianissimo"),
        deco("p", "p", SMUFL.dynP, "Piano"),
        deco("mp", "mp", SMUFL.dynMP, "Mezzo-piano"),
        deco("mf", "mf", SMUFL.dynMF, "Mezzo-forte"),
        deco("f", "f", SMUFL.dynF, "Forte"),
        deco("ff", "ff", SMUFL.dynFF, "Fortissimo"),
        deco("fff", "fff", SMUFL.dynFFF, "Fortississimo"),
        {
          id: "sfz",
          glyph: SMUFL.dynS + SMUFL.dynF + SMUFL.dynZ,
          label: "Sforzando (sfz)",
          onUse: () => ins("!sfz!"),
        },
        {
          id: "cresc",
          glyph: SMUFL.cresc,
          label: "Crescendo — wraps the passage",
          onUse: () => ins("!crescendo(!!crescendo)!", 12),
        },
        {
          id: "dim",
          glyph: SMUFL.dim,
          label: "Diminuendo — wraps the passage",
          onUse: () => ins("!diminuendo(!!diminuendo)!", 13),
        },
      ],
    },
    {
      kind: "group",
      id: "fing",
      icon: Hand,
      label: "Fingering",
      options: [1, 2, 3, 4, 5].map((n) => ({
        id: `f${n}`,
        char: String(n),
        label: `Finger ${n}`,
        onUse: () => ins(`!${n}!`),
      })),
    },
    {
      kind: "group",
      id: "ped",
      icon: Footprints,
      label: "Pedal",
      options: [
        { id: "pedon", icon: BatteryVerticalFull, label: "Pedal down", onUse: () => ins("!ped!") },
        {
          id: "pedoff",
          icon: BatteryVerticalEmpty,
          label: "Pedal up",
          onUse: () => ins("!ped-up!"),
        },
      ],
    },
    { kind: "sep" },
    {
      kind: "action",
      id: "csym",
      char: '"',
      label: "Chord symbol — type name inside",
      onUse: () => ins('""', 1),
    },
    {
      kind: "group",
      id: "annot",
      icon: TextT,
      label: "Annotations",
      options: [
        { id: "above", icon: ArrowUp, label: "Text above", onUse: () => ins('"^"', 1) },
        { id: "below", icon: ArrowDown, label: "Text below", onUse: () => ins('"_"', 1) },
        { id: "left", icon: ArrowLeft, label: "Text left", onUse: () => ins('"<"', 1) },
        { id: "right", icon: ArrowRight, label: "Text right", onUse: () => ins('">"', 1) },
        {
          id: "free",
          icon: ArrowsOutCardinal,
          label: "Free placement",
          onUse: () => ins('"@"', 1),
        },
      ],
    },
    { kind: "sep" },
    {
      kind: "action",
      id: "lyrics",
      icon: UserSound,
      label: "Lyrics line (w:)",
      onUse: () => insLine("w: "),
    },
    {
      // Change the score: add a new stave (voice) with the chosen clef.
      kind: "group",
      id: "addstaff",
      icon: PlusSquare,
      label: "Add staff",
      options: clefOptions((name) => applyScore(addStaff(headerNow(), bodyNow(), name)), " staff"),
    },
    {
      // Change the score: remove the bottom stave (kept while >1 staff exists).
      kind: "action",
      id: "removestaff",
      icon: MinusSquare,
      label: "Remove staff",
      disabled: staffIds(headerNow(), bodyNow()).length <= 1,
      onUse: () => applyScore(removeStaff(headerNow(), bodyNow())),
    },
  ];

  return (
    <div className={s.col}>
      <Toolbar label={t("cell.scoreTools")} tools={localizeTools(tools)} />
      <textarea
        key="hdr"
        ref={headRef}
        className={`${shared.codeMono} ${s.codeHeader} no-print`}
        aria-label={t("cell.scoreHeader")}
        spellCheck={false}
        defaultValue={header}
        rows={Math.max(2, header.split("\n").length)}
        onChange={setHeader}
      />
      <textarea
        key="src"
        ref={taRef}
        className={`${shared.codeMono} no-print`}
        aria-label={t("cell.scoreBody")}
        spellCheck={false}
        defaultValue={body}
        placeholder={"[V:RH] C D E F | G A B c |\n[V:LH] C,2 G,2 | C,2 G,2 |"}
        rows={Math.max(3, body.split("\n").length + 1)}
        onChange={setBody}
      />
      {err}
      {body.trim() && (
        <div className={`${shared.previewCard} no-print`}>
          <span className={shared.previewLabel}>{t("cell.preview")}</span>
          {staff}
        </div>
      )}
    </div>
  );
}
