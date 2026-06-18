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
} from "@phosphor-icons/react";
import type { Cell, Kind } from "./kinds.ts";
import NoteCell from "../components/NoteCell/NoteCell.tsx";
import ScoreCell from "../components/ScoreCell/ScoreCell.jsx";
import CifraCell from "../components/CifraCell/CifraCell.tsx";
import ImageCell from "../components/ImageCell/ImageCell.tsx";
import PdfCell from "../components/PdfCell/PdfCell.tsx";
import AudioCell from "../components/AudioCell/AudioCell.tsx";

export interface CellView {
  component: ComponentType<{ cell: Cell; editing: boolean }>;
  icon: Icon;
  tagLabelKey: string; // i18n key for the Cell tag (cell.*)
  addLabelKey: string; // i18n key for the AddBar button (addbar.*)
  typeClass: string; // class name in Cell.module.css
  accent: { c: string; ct: string }; // AddBar CSS custom-property names
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
    accent: { c: "--s-purple", ct: "--s-purple-tint" },
  },
  score: {
    component: ScoreCell,
    icon: MusicNotes,
    tagLabelKey: "cell.score",
    addLabelKey: "addbar.score",
    typeClass: "typeScore",
    accent: { c: "--s-magenta", ct: "--s-magenta-tint" },
  },
  cifra: {
    // Cast: each cell narrows its own kind; the registry dispatches by kind, so this is safe.
    component: CifraCell as CellView["component"],
    icon: Guitar,
    tagLabelKey: "cell.cifra",
    addLabelKey: "addbar.cifra",
    typeClass: "typeCifra",
    accent: { c: "--s-cinnamon", ct: "--s-cinnamon-tint" },
  },
  image: {
    component: ImageCell as CellView["component"],
    icon: ImageIcon,
    tagLabelKey: "cell.image",
    addLabelKey: "addbar.image",
    typeClass: "typeImage",
    accent: { c: "--s-seafoam", ct: "--s-seafoam-tint" },
  },
  pdf: {
    component: PdfCell as CellView["component"],
    icon: FilePdf,
    tagLabelKey: "cell.pdf",
    addLabelKey: "addbar.pdf",
    typeClass: "typePdf",
    accent: { c: "--s-blue", ct: "--s-blue-tint" },
  },
  audio: {
    component: AudioCell as CellView["component"],
    icon: Waveform,
    tagLabelKey: "cell.audio",
    addLabelKey: "addbar.audio",
    typeClass: "typeAudio",
    accent: { c: "--s-gold-strong", ct: "--s-gold-tint" },
  },
};

// AddBar's rainbow order — distinct from KINDS order, so it's listed explicitly.
export const ADD_BAR_ORDER: readonly Kind[] = ["score", "cifra", "audio", "image", "pdf", "note"];
