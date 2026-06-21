import { useState } from "react";
import { CodeIcon as Code, ArrowsOutSimpleIcon as ArrowsOut, CopyIcon as Copy } from "@phosphor-icons/react";
import { useI18n } from "../../providers/I18nProvider/I18nProvider.tsx";
import { useRoute } from "../../providers/RouteProvider/RouteProvider.tsx";
import { toast } from "../Toasts/toasts.ts";
import ToolScreen from "../ToolScreen/ToolScreen.tsx";
import s from "./SyntaxRef.module.css";

const SCREEN_ID = "syntax";

// Cheat sheet for the editable cells' syntaxes. Tokens are literal; the short descriptions are kept
// in English (like the ABC palette tooltips) — section titles reuse the localized cell labels. The
// dock shows a tabbed quick view; the expanded screen shows the full reference plus copyable
// starter templates.
const GROUPS = [
  {
    titleKey: "cell.note",
    rows: [
      ["**bold**", "Bold"],
      ["*italic*", "Italic"],
      ["# / ##", "Headings"],
      ["- item", "Bullet list"],
      ["1. item", "Numbered list"],
      ["- [ ] task", "Task / checkbox"],
      ["> quote", "Blockquote"],
      ["`code`", "Inline code"],
      ["[text](url)", "Link"],
      ["---", "Divider"],
    ],
  },
  {
    titleKey: "cell.score",
    rows: [
      ["C D E … B", "Notes (middle-C octave)"],
      ["c · C,", "Octave up · down"],
      ["^C _B =C", "Sharp · flat · natural"],
      ["C2 · C/2", "Longer · shorter"],
      ["z · | · :|", "Rest · bar · repeat"],
      ["[CEG]", "Chord"],
      ["X: T: M: L: K:", "Tune header fields"],
      ["K:C · M:4/4", "Key · meter"],
      ["L:1/8 · Q:1/4=120", "Default length · tempo"],
      ["(3CDE", "Triplet"],
      ["C>D", "Dotted rhythm"],
      ["C-C · (CD)", "Tie · slur"],
    ],
  },
  {
    titleKey: "cell.cifra",
    rows: [
      ["[C]word", "Chord above a lyric"],
      ["{Verse}", "Section heading"],
      ["| C | G |", "Measures"],
      ["A=440 / ±", "Transpose via the toolbar"],
    ],
  },
];

// Genuinely useful, paste-ready starters for the three editable cell types (`kind` = which cell).
// Titles/content are literal (like the syntax descriptions) — practice scaffolds, common patterns,
// and reference tables a learner actually reaches for.
const TEMPLATES: { title: string; kind: string; text: string }[] = [
  {
    title: "Daily practice routine",
    kind: "cell.note",
    text: "## Practice session\n\n**Warm-up — 5 min**\n- [ ] Long tones / finger stretches\n- [ ] C major scale, hands separately\n\n**Technique — 10 min**\n- [ ] Scales: ____ major & minor\n- [ ] Arpeggios: ____\n\n**Repertoire — 15 min**\n- [ ] ____ · bars ____ slow → up to tempo\n\n**Review — 5 min**\n- [ ] Yesterday's trouble spots\n",
  },
  {
    title: "Practice log",
    kind: "cell.note",
    text: "| Date | Piece | BPM | Focus | ✓ |\n| --- | --- | --- | --- | --- |\n|  |  |  |  |  |\n|  |  |  |  |  |\n|  |  |  |  |  |\n",
  },
  {
    title: "Circle of fifths",
    kind: "cell.note",
    text: "## Circle of fifths\n\n| Key | Sharps / flats | Rel. minor |\n| --- | --- | --- |\n| C | — | Am |\n| G | 1♯ | Em |\n| D | 2♯ | Bm |\n| A | 3♯ | F♯m |\n| E | 4♯ | C♯m |\n| B | 5♯ | G♯m |\n| F | 1♭ | Dm |\n| B♭ | 2♭ | Gm |\n| E♭ | 3♭ | Cm |\n| A♭ | 4♭ | Fm |\n",
  },
  {
    title: "Chords in a major key",
    kind: "cell.note",
    text: "## Diatonic chords (major)\n\n| Key | I | ii | iii | IV | V | vi | vii° |\n| --- | --- | --- | --- | --- | --- | --- | --- |\n| C | C | Dm | Em | F | G | Am | B° |\n| G | G | Am | Bm | C | D | Em | F♯° |\n| D | D | Em | F♯m | G | A | Bm | C♯° |\n| A | A | Bm | C♯m | D | E | F♯m | G♯° |\n| F | F | Gm | Am | B♭ | C | Dm | E° |\n",
  },
  {
    title: "C major scale",
    kind: "cell.score",
    text: "X:1\nT:C major scale\nM:4/4\nL:1/8\nK:C\nCDEF GABc | cBAG FEDC |]\n",
  },
  {
    title: "Five-finger warm-up",
    kind: "cell.score",
    text: "X:1\nT:Five-finger warm-up\nM:4/4\nL:1/8\nK:C\nCDEF GFED | CDEF GFED |]\n",
  },
  {
    title: "Major arpeggio",
    kind: "cell.score",
    text: "X:1\nT:C major arpeggio\nM:4/4\nL:1/8\nK:C\nCEGc cGEC | C4 z4 |]\n",
  },
  {
    title: "I–V–vi–IV (key of C)",
    kind: "cell.cifra",
    text: "{I–V–vi–IV · key of C}\n[C]      [G]      [Am]      [F]\n",
  },
  {
    title: "ii–V–I (key of C)",
    kind: "cell.cifra",
    text: "{ii–V–I · key of C}\n[Dm7]      [G7]      [Cmaj7]\n",
  },
  {
    title: "12-bar blues (key of A)",
    kind: "cell.cifra",
    text: "{12-bar blues · key of A}\n[A7]      [A7]      [A7]      [A7]\n[D7]      [D7]      [A7]      [A7]\n[E7]      [D7]      [A7]      [E7]\n",
  },
];

export default function SyntaxRef() {
  const { t } = useI18n();
  const { screen, openScreen, closeScreen } = useRoute();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const onScreen = screen === SCREEN_ID;
  const group = GROUPS[active];

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.positive(t("reference.copied"));
    } catch {
      toast.negative(t("reference.copyFailed"));
    }
  }

  const dockClass = [s.dock, "no-print", open && s.open].filter(Boolean).join(" ");

  return (
    <>
      <div className={dockClass}>
        <div className={s.tab}>
          <button
            type="button"
            className={s.tabExpand}
            onClick={() => openScreen(SCREEN_ID)}
            aria-label={`${t("screen.expand")} — ${t("reference.name")}`}
          >
            <ArrowsOut size={16} aria-hidden />
          </button>
          <button
            type="button"
            className={s.tabToggle}
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-label={open ? t("reference.hide") : t("reference.show")}
          >
            <Code size={22} aria-hidden />
            <span className={s.tabLabel}>{t("reference.name")}</span>
          </button>
        </div>

        {!onScreen && (
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
        )}
      </div>

      {onScreen && (
        <ToolScreen title={t("reference.name")} icon={Code} accent="--s-purple" wide onClose={closeScreen}>
          {GROUPS.map((g) => (
            <section key={g.titleKey} className={s.section}>
              <h2 className={s.sectionTitle}>{t(g.titleKey)}</h2>
              <div className={s.refGrid}>
                {g.rows.map(([code, desc], i) => (
                  <div key={i} className={s.row}>
                    <code className={s.code}>{code}</code>
                    <span className={s.desc}>{desc}</span>
                  </div>
                ))}
              </div>
            </section>
          ))}

          <section className={s.section}>
            <h2 className={s.sectionTitle}>{t("reference.templates")}</h2>
            <div className={s.templates}>
              {TEMPLATES.map((tpl) => (
                <div key={tpl.title} className={s.template}>
                  <div className={s.tplHead}>
                    <span className={s.tplTitle}>{tpl.title}</span>
                    <span className={s.tplKind}>{t(tpl.kind)}</span>
                    <button type="button" className={s.copyBtn} onClick={() => copy(tpl.text)}>
                      <Copy size={15} aria-hidden /> {t("reference.copy")}
                    </button>
                  </div>
                  <pre className={s.tplBody}>{tpl.text}</pre>
                </div>
              ))}
            </div>
          </section>
        </ToolScreen>
      )}
    </>
  );
}
