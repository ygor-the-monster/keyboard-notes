import { useState } from "react";
import { Code } from "@phosphor-icons/react";
import { useI18n } from "../../providers/I18nProvider/I18nProvider.tsx";
import s from "./SyntaxRef.module.css";

// Pull-tab cheat sheet for the editable cells' syntaxes. The tokens are literal; the short
// descriptions are kept in English (like the ABC palette tooltips) — section titles reuse
// the localized cell labels.
const GROUPS = [
  {
    titleKey: "cell.note",
    rows: [
      ["**bold**", "Bold"],
      ["*italic*", "Italic"],
      ["# / ##", "Headings"],
      ["- item", "Bullet list"],
      ["- [ ] task", "Task / checkbox"],
      ["> quote", "Blockquote"],
      ["`code`", "Inline code"],
    ],
  },
  {
    titleKey: "cell.music",
    rows: [
      ["C D E … B", "Notes (middle-C octave)"],
      ["c · C,", "Octave up · down"],
      ["^C _B =C", "Sharp · flat · natural"],
      ["C2 · C/2", "Longer · shorter"],
      ["z · | · :|", "Rest · bar · repeat"],
      ["[CEG]", "Chord"],
    ],
  },
  {
    titleKey: "cell.cifra",
    rows: [
      ["[C]word", "Chord above a lyric"],
      ["{Verse}", "Section heading"],
      ["A=440 / ±", "Transpose via the toolbar"],
    ],
  },
];

export default function SyntaxRef() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const dockClass = [s.dock, "no-print", open && s.open].filter(Boolean).join(" ");
  const group = GROUPS[active];

  return (
    <div className={dockClass}>
      <button
        type="button"
        className={s.tab}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={open ? t("reference.hide") : t("reference.show")}
      >
        <Code size={22} aria-hidden />
        <span className={s.tabLabel}>{t("reference.name")}</span>
      </button>

      <div className={s.card}>
        <div className={s.head}>
          <Code size={18} aria-hidden />
          <span>{t("reference.name")}</span>
        </div>
        <div className={s.tabs} role="tablist" aria-label={t("reference.name")}>
          {GROUPS.map((g, i) => (
            <button
              key={g.titleKey}
              type="button"
              role="tab"
              aria-selected={active === i}
              className={`${s.tabBtn}${active === i ? ` ${s.tabOn}` : ""}`}
              onClick={() => setActive(i)}
            >
              {t(g.titleKey)}
            </button>
          ))}
        </div>
        <div className={s.scroll}>
          {group.rows.map(([code, desc], i) => (
            <div key={i} className={s.row}>
              <code className={s.code}>{code}</code>
              <span className={s.desc}>{desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
