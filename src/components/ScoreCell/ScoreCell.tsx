import { useEffect, useRef, useState } from "react";
import { useStore } from "../../providers/StoreProvider/StoreProvider.tsx";
import { useI18n } from "../../providers/I18nProvider/I18nProvider.tsx";
import EmptyState from "../EmptyState/EmptyState.tsx";
import {
  getAbcjs,
  splitAbc,
  joinAbc,
  cleanAbc,
  smartNote,
  wrapNotes,
  parseTempo,
  withTempo,
} from "./ScoreCell.utils.ts";
import { insertIntoTextarea } from "../../utils/textEditing/textEditing.ts";
import { buildScoreTools } from "./ScoreCell.tools.ts";
import Toolbar from "../Toolbar/Toolbar.tsx";
import type { CellOf } from "../../utils/cellKinds/cellKinds.ts";
import type { MidiBuffer } from "abcjs";
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
  const { t } = useI18n();
  const renderRef = useRef<HTMLDivElement>(null);
  const errRef = useRef<HTMLDivElement>(null);
  const synthRef = useRef<MidiBuffer | null>(null);
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

  const tools = buildScoreTools({
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
  });

  return (
    <div className={s.col}>
      <Toolbar label={t("cell.scoreTools")} tools={tools} />
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
