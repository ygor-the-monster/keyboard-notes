import { useEffect, useRef } from "react";
import { ArrowUUpLeftIcon as ArrowUUpLeft } from "@phosphor-icons/react";
import { useStore } from "../../providers/StoreProvider/StoreProvider.tsx";
import { useI18n } from "../../providers/I18nProvider/I18nProvider.tsx";
import { useAutoScroll, buildScrollTools } from "../../hooks/useAutoScroll.ts";
import { parseCifra, transposeLabel } from "./CifraCell.utils.ts";
import type { CifraBlock } from "./CifraCell.utils.ts";
import EmptyState from "../EmptyState/EmptyState.tsx";
import Toolbar from "../Toolbar/Toolbar.tsx";
import type { Tool } from "../Toolbar/Toolbar.tsx";
import type { CellOf } from "../../utils/cellKinds/cellKinds.ts";
import shared from "../../providers/ThemeProvider/ThemeProvider.module.css";
import css from "./CifraCell.module.css";

const clampTranspose = (n: number) => Math.max(-11, Math.min(11, n));

function Chart({ blocks }: { blocks: CifraBlock[] }) {
  return (
    <div className={css.chart}>
      {blocks.map((b, i) => {
        if (b.type === "blank") return <div key={i} className={css.blank} />;
        if (b.type === "heading")
          return (
            <div key={i} className={css.heading}>
              {b.text}
            </div>
          );
        if (b.type === "plain")
          return (
            <div key={i} className={css.plain}>
              {b.text}
            </div>
          );
        return (
          <div key={i} className={css.line}>
            {b.lead ? (
              <span className={css.seg}>
                <span className={css.chord} />
                {b.lead}
              </span>
            ) : null}
            {b.segs.map((sg, j) => (
              <span key={j} className={css.seg}>
                <span className={css.chord}>{sg.chord}</span>
                <span className={css.lyric}>{sg.text || " "}</span>
              </span>
            ))}
          </div>
        );
      })}
    </div>
  );
}

export default function CifraCell({ cell, editing }: { cell: CellOf<"cifra">; editing: boolean }) {
  const { updateCell } = useStore();
  const { t } = useI18n();
  const taRef = useRef<HTMLTextAreaElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const { scrolling, speed, toggle, setSpeed } = useAutoScroll(rootRef);

  const transpose = cell.transpose || 0;
  const blocks = parseCifra(cell.source, transpose);
  const hasContent = (cell.source || "").trim().length > 0;

  useEffect(() => {
    const ta = taRef.current;
    if (ta && ta.value !== cell.source) ta.value = cell.source;
  }, [cell.source]);

  const setTranspose = (n: number) => updateCell(cell.id, { transpose: clampTranspose(n) });

  // Transpose + auto-scroll controls, shared by the performance (rendered) and editor views —
  // auto-scroll belongs in both, since you may set it up while editing too.
  const controls: Tool[] = [
    {
      kind: "spinner",
      id: "transpose",
      label: t("cifra.transpose"),
      display: transposeLabel(transpose),
      onPrev: () => setTranspose(transpose - 1),
      onNext: () => setTranspose(transpose + 1),
      prevDisabled: transpose <= -11,
      nextDisabled: transpose >= 11,
    },
    ...(transpose !== 0
      ? [
          {
            kind: "action" as const,
            id: "reset",
            icon: ArrowUUpLeft,
            label: t("cifra.original"),
            onUse: () => setTranspose(0),
          },
        ]
      : []),
    { kind: "sep" },
    ...buildScrollTools({ t, scrolling, toggle, speed, setSpeed }),
  ];

  // ---- compact view ----------------------------------------------------------
  // Pure read-only chart: clicking anywhere expands the cell, where the controls live.
  if (!editing) {
    if (!hasContent) return <EmptyState kind="chords" title={t("cifra.empty")} compact />;
    return (
      <div ref={rootRef} className={css.col}>
        <Chart blocks={blocks} />
      </div>
    );
  }

  // ---- expanded / performance view -------------------------------------------
  return (
    <div ref={rootRef} className={css.col}>
      <Toolbar label={t("cell.cifra")} tools={controls} />
      <textarea
        ref={taRef}
        className={`${shared.codeMono} no-print`}
        aria-label={t("cell.cifra")}
        spellCheck={false}
        defaultValue={cell.source}
        placeholder={t("cifra.placeholder")}
        rows={Math.max(4, (cell.source || "").split("\n").length + 1)}
        onChange={(e) => updateCell(cell.id, { source: e.target.value })}
        autoFocus
      />
      {hasContent && (
        <div className={`${shared.previewCard} no-print`}>
          <span className={shared.previewLabel}>{t("cell.preview")}</span>
          <Chart blocks={blocks} />
        </div>
      )}
    </div>
  );
}
