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
import { addStaff, removeStaff, staffIds, SMUFL } from "./ScoreCell.utils.ts";
import { buildAssistantTool } from "../AssistantPanel/assistantTool.ts";
import { runNotationTransform } from "../../utils/notationAssistant/notationAssistant.ts";
import type { GroupOption, Tool } from "../Toolbar/Toolbar.tsx";

const TEMPO_STEP = 2;

// The shared clef list — reused by the "Clef" group (inline change) and the "Add staff" group
// (new stave). Labels read through `t` under score.clef.* / score.staff.*.
const CLEFS = [
  { id: "treble", name: "treble", char: "G" },
  { id: "bass", name: "bass", char: "F" },
  { id: "alto", name: "alto", char: "C3" },
  { id: "tenor", name: "tenor", char: "C4" },
  { id: "treble8up", name: "treble+8", char: "G+8" },
  { id: "treble8dn", name: "treble-8", char: "G-8" },
  { id: "bass8up", name: "bass+8", char: "F+8" },
  { id: "bass8dn", name: "bass-8", char: "F-8" },
  { id: "none", name: "none", char: "—" },
  { id: "perc", name: "perc", char: "x" },
];

interface ScoreToolsArgs {
  t: (key: string, vars?: Record<string, unknown>) => string;
  ins: (text: string, back?: number) => void;
  smart: (kind: string, arg: string | number, fallback: string, back?: number) => void;
  wrapSel: (kind: string, fallback: string, back?: number) => void;
  insLine: (text: string) => void;
  applyScore: (next: { header?: string; body?: string }) => void;
  headerNow: () => string;
  bodyNow: () => string;
  playing: boolean;
  play: () => void;
  stop: () => void;
  tempoNow: () => number;
  setTempo: (bpm: number) => void;
}

// The Score (ABC) editor's unified-Toolbar tools — playback, the note/rhythm palette, and the
// structural staff edits. Pure: every label reads through `t`; every action delegates to the
// caret-aware editing handlers passed in.
export function buildScoreTools({
  t,
  ins,
  smart,
  wrapSel,
  insLine,
  applyScore,
  headerNow,
  bodyNow,
  playing,
  play,
  stop,
  tempoNow,
  setTempo,
}: ScoreToolsArgs): Tool[] {
  const note = (n: string): GroupOption => ({
    id: n,
    char: n,
    label: t("score.note", { n }),
    onUse: () => ins(n),
  });
  // Decoration option: inserts an ABC !name! bang-decoration before the next note.
  const deco = (id: string, name: string, glyph: string): GroupOption => ({
    id,
    glyph,
    label: t(`score.deco.${id}`),
    onUse: () => ins(`!${name}!`),
  });
  const clefOptions = (act: (name: string) => void, ns: "clef" | "staff"): GroupOption[] =>
    CLEFS.map((c) => ({
      id: c.id,
      char: c.char,
      label: t(`score.${ns}.${c.id}`),
      onUse: () => act(c.name),
    }));

  return [
    {
      kind: "toggle",
      id: "play",
      icon: Play,
      altIcon: Stop,
      tone: "play",
      label: t("score.play"),
      altLabel: t("score.stop"),
      value: playing,
      onToggle: () => (playing ? stop() : play()),
    },
    {
      kind: "spinner",
      id: "tempo",
      label: t("score.tempo"),
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
      label: t("score.notesGroup"),
      options: [
        ...["C", "D", "E", "F", "G", "A", "B"].map(note),
        { id: "c", char: "c", label: t("score.noteCUp"), onUse: () => ins("c") },
      ],
    },
    {
      kind: "group",
      id: "acc",
      icon: Hash,
      label: t("score.accidentals"),
      options: [
        {
          id: "sharp",
          glyph: SMUFL.sharp,
          label: t("score.sharp"),
          onUse: () => smart("accidental", "^", "^"),
        },
        {
          id: "flat",
          glyph: SMUFL.flat,
          label: t("score.flat"),
          onUse: () => smart("accidental", "_", "_"),
        },
        {
          id: "nat",
          glyph: SMUFL.natural,
          label: t("score.natural"),
          onUse: () => smart("accidental", "=", "="),
        },
      ],
    },
    {
      kind: "group",
      id: "oct",
      icon: ShuffleSimple,
      label: t("score.octaveGroup"),
      options: [
        {
          id: "up",
          icon: ArrowUpRight,
          label: t("score.octaveUp"),
          onUse: () => smart("octave", 1, "'"),
        },
        {
          id: "down",
          icon: ArrowDownRight,
          label: t("score.octaveDown"),
          onUse: () => smart("octave", -1, ","),
        },
      ],
    },
    { kind: "sep" },
    {
      kind: "group",
      id: "len",
      icon: SplitHorizontal,
      label: t("score.length"),
      options: [
        { id: "whole", char: "4", label: t("score.whole"), onUse: () => smart("length", "4", "4") },
        { id: "half", char: "2", label: t("score.half"), onUse: () => smart("length", "2", "2") },
        {
          id: "eighth",
          char: "½",
          label: t("score.eighth"),
          onUse: () => smart("length", "/2", "/2"),
        },
        {
          id: "sixteenth",
          char: "¼",
          label: t("score.sixteenth"),
          onUse: () => smart("length", "/4", "/4"),
        },
      ],
    },
    {
      kind: "group",
      id: "rhythm",
      icon: FlowArrow,
      label: t("score.dottedRhythm"),
      options: [
        { id: "dot", char: ">", label: t("score.dotted"), onUse: () => ins(">") },
        { id: "rdot", char: "<", label: t("score.reverseDotted"), onUse: () => ins("<") },
      ],
    },
    {
      kind: "group",
      id: "tup",
      icon: CirclesThree,
      label: t("score.tuplets"),
      options: [
        { id: "t3", char: "3", label: t("score.triplet"), onUse: () => ins("(3") },
        { id: "t2", char: "2", label: t("score.duplet"), onUse: () => ins("(2") },
        { id: "t5", char: "5", label: t("score.quintuplet"), onUse: () => ins("(5") },
        { id: "tg", char: "n", label: t("score.generalTuplet"), onUse: () => ins("(") },
      ],
    },
    {
      kind: "group",
      id: "phr",
      icon: PianoKeys,
      label: t("score.phrasing"),
      options: [
        {
          id: "chord",
          char: "[]",
          label: t("score.chord"),
          onUse: () => wrapSel("chord", "[]", 1),
        },
        { id: "tie", char: "‿", label: t("score.tie"), onUse: () => ins("-") },
        { id: "slur", char: "()", label: t("score.slur"), onUse: () => wrapSel("slur", "()", 1) },
        {
          id: "grace",
          glyph: SMUFL.grace,
          dy: 0.21,
          label: t("score.grace"),
          onUse: () => ins("{}", 1),
        },
        {
          id: "acci",
          glyph: SMUFL.acciaccatura,
          dy: 0.21,
          label: t("score.acciaccatura"),
          onUse: () => ins("{/}", 1),
        },
      ],
    },
    { kind: "sep" },
    {
      kind: "group",
      id: "rests",
      icon: SpeakerSimpleNone,
      label: t("score.rests"),
      options: [
        { id: "z", glyph: SMUFL.restQuarter, label: t("score.restVisible"), onUse: () => ins("z") },
        {
          id: "x",
          glyph: SMUFL.restQuarter,
          dim: true,
          label: t("score.restInvisible"),
          onUse: () => ins("x"),
        },
        {
          id: "Z",
          glyph: SMUFL.restDoubleWhole,
          label: t("score.restMulti"),
          onUse: () => ins("Z"),
        },
        { id: "y", icon: ArrowsOutLineHorizontal, label: t("score.spacer"), onUse: () => ins("y") },
      ],
    },
    {
      kind: "group",
      id: "bars",
      icon: LineVertical,
      label: t("score.bars"),
      options: [
        { id: "bar", char: "|", label: t("score.barLine"), onUse: () => ins(" | ") },
        { id: "dbl", char: "‖", label: t("score.doubleBar"), onUse: () => ins(" || ") },
        { id: "fin", char: "|]", label: t("score.finalBar"), onUse: () => ins(" |] ") },
        { id: "thin", char: "[|", label: t("score.thickThin"), onUse: () => ins(" [| ") },
        { id: "rs", char: "|:", label: t("score.repeatStart"), onUse: () => ins(" |: ") },
        { id: "re", char: ":|", label: t("score.repeatEnd"), onUse: () => ins(" :| ") },
        { id: "rb", char: "::", label: t("score.repeatBoth"), onUse: () => ins(" :: ") },
        { id: "e1", char: "1", label: t("score.firstEnding"), onUse: () => ins("[1 ") },
        { id: "e2", char: "2", label: t("score.secondEnding"), onUse: () => ins("[2 ") },
      ],
    },
    {
      kind: "group",
      id: "oshift",
      icon: ShuffleAngular,
      label: t("score.octaveShift"),
      options: [
        {
          id: "up",
          icon: ArrowUpRight,
          label: t("score.octave8va"),
          onUse: () => ins("!8va(!!8va)!", 6),
        },
        {
          id: "down",
          icon: ArrowDownRight,
          label: t("score.octave8vb"),
          onUse: () => ins("!8vb(!!8vb)!", 6),
        },
      ],
    },
    {
      // Change the clef of the current line, inline.
      kind: "group",
      id: "clef",
      icon: MusicNoteSimple,
      label: t("score.clefMenu"),
      options: clefOptions((name) => ins(`[K:clef=${name}]`), "clef"),
    },
    { kind: "sep" },
    {
      kind: "group",
      id: "orn",
      icon: Waveform,
      label: t("score.ornaments"),
      options: [
        deco("stac", "staccato", SMUFL.staccato),
        deco("accent", "accent", SMUFL.accent),
        deco("ten", "tenuto", SMUFL.tenuto),
        deco("marc", "marcato", SMUFL.marcato),
        deco("fer", "fermata", SMUFL.fermata),
        deco("tr", "trill", SMUFL.trill),
        deco("mor", "mordent", SMUFL.mordent),
        deco("lmor", "lowermordent", SMUFL.mordentLower),
        deco("turn", "turn", SMUFL.turn),
        deco("iturn", "invertedturn", SMUFL.turnInverted),
      ],
    },
    {
      kind: "group",
      id: "dyn",
      icon: Vibrate,
      label: t("score.dynamics"),
      options: [
        deco("ppp", "ppp", SMUFL.dynPPP),
        deco("pp", "pp", SMUFL.dynPP),
        deco("p", "p", SMUFL.dynP),
        deco("mp", "mp", SMUFL.dynMP),
        deco("mf", "mf", SMUFL.dynMF),
        deco("f", "f", SMUFL.dynF),
        deco("ff", "ff", SMUFL.dynFF),
        deco("fff", "fff", SMUFL.dynFFF),
        {
          id: "sfz",
          glyph: SMUFL.dynS + SMUFL.dynF + SMUFL.dynZ,
          label: t("score.sfz"),
          onUse: () => ins("!sfz!"),
        },
        {
          id: "cresc",
          glyph: SMUFL.cresc,
          label: t("score.crescendo"),
          onUse: () => ins("!crescendo(!!crescendo)!", 12),
        },
        {
          id: "dim",
          glyph: SMUFL.dim,
          label: t("score.diminuendo"),
          onUse: () => ins("!diminuendo(!!diminuendo)!", 13),
        },
      ],
    },
    {
      kind: "group",
      id: "fing",
      icon: Hand,
      label: t("score.fingering"),
      options: [1, 2, 3, 4, 5].map((n) => ({
        id: `f${n}`,
        char: String(n),
        label: t("score.finger", { n }),
        onUse: () => ins(`!${n}!`),
      })),
    },
    {
      kind: "group",
      id: "ped",
      icon: Footprints,
      label: t("score.pedal"),
      options: [
        {
          id: "pedon",
          icon: BatteryVerticalFull,
          label: t("score.pedalDown"),
          onUse: () => ins("!ped!"),
        },
        {
          id: "pedoff",
          icon: BatteryVerticalEmpty,
          label: t("score.pedalUp"),
          onUse: () => ins("!ped-up!"),
        },
      ],
    },
    { kind: "sep" },
    {
      kind: "action",
      id: "csym",
      char: '"',
      label: t("score.chordSymbol"),
      onUse: () => ins('""', 1),
    },
    {
      kind: "group",
      id: "annot",
      icon: TextT,
      label: t("score.annotations"),
      options: [
        { id: "above", icon: ArrowUp, label: t("score.textAbove"), onUse: () => ins('"^"', 1) },
        { id: "below", icon: ArrowDown, label: t("score.textBelow"), onUse: () => ins('"_"', 1) },
        { id: "left", icon: ArrowLeft, label: t("score.textLeft"), onUse: () => ins('"<"', 1) },
        { id: "right", icon: ArrowRight, label: t("score.textRight"), onUse: () => ins('">"', 1) },
        {
          id: "free",
          icon: ArrowsOutCardinal,
          label: t("score.freePlacement"),
          onUse: () => ins('"@"', 1),
        },
      ],
    },
    { kind: "sep" },
    {
      kind: "action",
      id: "lyrics",
      icon: UserSound,
      label: t("score.lyrics"),
      onUse: () => insLine("w: "),
    },
    {
      // Change the score: add a new stave (voice) with the chosen clef.
      kind: "group",
      id: "addstaff",
      icon: PlusSquare,
      label: t("score.addStaff"),
      options: clefOptions((name) => applyScore(addStaff(headerNow(), bodyNow(), name)), "staff"),
    },
    {
      // Change the score: remove the bottom stave (kept while >1 staff exists).
      kind: "action",
      id: "removestaff",
      icon: MinusSquare,
      label: t("score.removeStaff"),
      disabled: staffIds(headerNow(), bodyNow()).length <= 1,
      onUse: () => applyScore(removeStaff(headerNow(), bodyNow())),
    },
    { kind: "sep" },
    // On-device "describe an edit" assistant — last in the list (an optional power feature, not
    // pushed up front). Runs a small LLM in the browser, validates its ABC against abcjs, and
    // applies it. The heavy model loads lazily on first use (see AssistantPanel).
    buildAssistantTool<{ header?: string; body: string }>({
      t,
      hintKey: "assistant.hint",
      accent: "--s-magenta", // matches cellRegistry score hue
      snapshot: () => ({ header: headerNow(), body: bodyNow() }),
      apply: applyScore,
      transform: (instruction, onProgress, tier) =>
        runNotationTransform(instruction, headerNow(), bodyNow(), onProgress, tier),
    }),
  ];
}
