import {
  Article,
  MusicNotes,
  Image as ImageIcon,
  FilePdf,
  Waveform,
  Guitar,
  Plus,
} from "@phosphor-icons/react";
import { useStore } from "../../providers/StoreProvider/StoreProvider.jsx";
import { useEditing } from "../../providers/EditingProvider/EditingProvider.jsx";
import { useI18n } from "../../providers/I18nProvider/I18nProvider.jsx";
import s from "./AddBar.module.css";

// Each add button wears its cell type's accent (icon + hover tint), matching the cell tag.
// Rainbow order: Score · Chords · Audio · Image · PDF · Note.
const ITEMS = [
  { type: "abc", icon: MusicNotes, labelKey: "addbar.music", c: "--s-magenta", ct: "--s-magenta-tint" },
  { type: "cifra", icon: Guitar, labelKey: "addbar.cifra", c: "--s-cinnamon", ct: "--s-cinnamon-tint" },
  { type: "snd", icon: Waveform, labelKey: "addbar.audio", c: "--s-gold-strong", ct: "--s-gold-tint" },
  { type: "img", icon: ImageIcon, labelKey: "addbar.image", c: "--s-seafoam", ct: "--s-seafoam-tint" },
  { type: "pdf", icon: FilePdf, labelKey: "addbar.pdf", c: "--s-blue", ct: "--s-blue-tint" },
  { type: "md", icon: Article, labelKey: "addbar.note", c: "--s-purple", ct: "--s-purple-tint" },
];

export default function AddBar() {
  const { addCell } = useStore();
  const { setEditing } = useEditing();
  const { t } = useI18n();
  return (
    <div className={`${s.wrap} no-print`}>
      <div className={s.label}>
        <span className={s.rule} />
        <Plus size={16} aria-hidden />
        <span className={s.labelText}>{t("addbar.title")}</span>
        <span className={s.rule} />
      </div>
      <div className={s.row}>
        {ITEMS.map((it) => {
          const Icon = it.icon;
          return (
            <button
              key={it.type}
              type="button"
              className={s.addBtn}
              style={{ "--c": `var(${it.c})`, "--ct": `var(${it.ct})` }}
              aria-label={t(it.labelKey)}
              title={t(it.labelKey)}
              onClick={() => setEditing(addCell(it.type))}
            >
              <Icon size={24} aria-hidden />
            </button>
          );
        })}
      </div>
    </div>
  );
}
