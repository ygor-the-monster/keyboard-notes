// The view side of the Cell-kind registry: per-kind component, icon, labels, tag class, and
// AddBar accent. Imported by Cell.tsx (dispatch + tag) and AddBar.tsx (add buttons). Holds the
// React/icon concerns kept out of kinds.ts so the model stays importable without component-land.
import type { ComponentType } from "react";
import type { Icon } from "@phosphor-icons/react";
import {
  ArticleIcon as Article,
  MusicNotesIcon as MusicNotes,
  GuitarIcon as Guitar,
  ImageIcon,
  FilePdfIcon as FilePdf,
  WaveformIcon as Waveform,
  ArrowSquareOutIcon as ArrowSquareOut,
} from "@phosphor-icons/react";
import type { Cell, Kind } from "../cellKinds/cellKinds.ts";
import NoteCell from "../../components/NoteCell/NoteCell.tsx";
import ScoreCell from "../../components/ScoreCell/ScoreCell.tsx";
import CifraCell from "../../components/CifraCell/CifraCell.tsx";
import ImageCell from "../../components/ImageCell/ImageCell.tsx";
import PdfCell from "../../components/PdfCell/PdfCell.tsx";
import AudioCell from "../../components/AudioCell/AudioCell.tsx";
import ExternalCell from "../../components/ExternalCell/ExternalCell.tsx";

export interface CellView {
  component: ComponentType<{ cell: Cell; editing: boolean }>;
  icon: Icon;
  tagLabelKey: string; // i18n key for the Cell tag (cell.*)
  addLabelKey: string; // i18n key for the AddBar button (addbar.*)
  typeClass: string; // class name in Cell.module.css
  // The kind's rainbow hue, as Spectrum CSS custom-property names: `base` (the AddBar fill and the
  // undo-toast accent), `tint` (the AddBar wash), `strong` (the undo-toast's stronger accent). Gold
  // is pale, so its `base` is the -strong variant to stay legible. Single source — App and AddBar
  // both read here, so the hue can't drift across them.
  hue: { base: string; tint: string; strong: string };
}

// Typed `Record<Kind, …>`, so a Kind without a view entry is a compile error under tsgo — this
// map and cellKinds cannot drift from KINDS or from each other.
export const cellRegistry: Record<Kind, CellView> = {
  note: {
    component: NoteCell as CellView["component"],
    icon: Article,
    tagLabelKey: "cell.note",
    addLabelKey: "addbar.note",
    typeClass: "typeNote",
    hue: { base: "--s-purple", tint: "--s-purple-tint", strong: "--s-purple-strong" },
  },
  score: {
    component: ScoreCell as CellView["component"],
    icon: MusicNotes,
    tagLabelKey: "cell.score",
    addLabelKey: "addbar.score",
    typeClass: "typeScore",
    hue: { base: "--s-magenta", tint: "--s-magenta-tint", strong: "--s-magenta-strong" },
  },
  cifra: {
    // Cast: each cell narrows its own kind; the registry dispatches by kind, so this is safe.
    component: CifraCell as CellView["component"],
    icon: Guitar,
    tagLabelKey: "cell.cifra",
    addLabelKey: "addbar.cifra",
    typeClass: "typeCifra",
    hue: { base: "--s-cinnamon", tint: "--s-cinnamon-tint", strong: "--s-cinnamon-strong" },
  },
  image: {
    component: ImageCell as CellView["component"],
    icon: ImageIcon,
    tagLabelKey: "cell.image",
    addLabelKey: "addbar.image",
    typeClass: "typeImage",
    hue: { base: "--s-seafoam", tint: "--s-seafoam-tint", strong: "--s-seafoam-strong" },
  },
  pdf: {
    component: PdfCell as CellView["component"],
    icon: FilePdf,
    tagLabelKey: "cell.pdf",
    addLabelKey: "addbar.pdf",
    typeClass: "typePdf",
    hue: { base: "--s-blue", tint: "--s-blue-tint", strong: "--s-blue-strong" },
  },
  audio: {
    component: AudioCell as CellView["component"],
    icon: Waveform,
    tagLabelKey: "cell.audio",
    addLabelKey: "addbar.audio",
    typeClass: "typeAudio",
    // Gold is pale: `base` uses the -strong variant so the fill and accent stay legible.
    hue: { base: "--s-gold-strong", tint: "--s-gold-tint", strong: "--s-gold-strong" },
  },
  external: {
    component: ExternalCell as CellView["component"],
    icon: ArrowSquareOut,
    tagLabelKey: "cell.external",
    addLabelKey: "addbar.external",
    typeClass: "typeExternal",
    // Silver — the one achromatic kind: External points outside the notebook, so it stays out of
    // the rainbow reserved for native content (see ThemeProvider.globals.css).
    hue: { base: "--s-silver", tint: "--s-silver-tint", strong: "--s-silver-strong" },
  },
};

// AddBar's rainbow order — distinct from KINDS order, so it's listed explicitly.
export const ADD_BAR_ORDER: readonly Kind[] = [
  "score",
  "cifra",
  "audio",
  "image",
  "pdf",
  "note",
  "external",
];
