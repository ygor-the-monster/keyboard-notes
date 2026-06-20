import { type CSSProperties, useLayoutEffect, useRef, useState } from "react";
import { PlusIcon as Plus } from "@phosphor-icons/react";
import { useStore } from "../../providers/StoreProvider/StoreProvider.tsx";
import { useEditing } from "../../providers/EditingProvider/EditingProvider.tsx";
import { useI18n } from "../../providers/I18nProvider/I18nProvider.tsx";
import { cellRegistry, ADD_BAR_ORDER } from "../../utils/cellRegistry/cellRegistry.tsx";
import s from "./AddBar.module.css";

// Keep these in sync with .addBtn / .row in AddBar.module.css.
const BTN_W = 54;
const GAP = 10;
// The left-edge utility dock tabs (~42px) sit fixed and vertically centred. Reserve that
// zone on *both* sides so the centred button rows never slide under a tab on narrow screens.
const TAB_SAFE = 48;

/**
 * Measures the available width and returns how many buttons to put on each row so the total
 * splits into *evenly sized* rows (e.g. 4+3 rather than flex-wrap's greedy 6+1). The buttons
 * stay centred and clear of the fixed dock tabs.
 */
function useEvenRows(count: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [perRow, setPerRow] = useState(count);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const usable = el.clientWidth - TAB_SAFE * 2;
      const fit = Math.max(1, Math.floor((usable + GAP) / (BTN_W + GAP)));
      const rows = Math.ceil(count / Math.min(fit, count));
      setPerRow(Math.ceil(count / rows));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [count]);
  return { ref, perRow };
}

export default function AddBar() {
  const { addCell } = useStore();
  const { setEditing } = useEditing();
  const { t } = useI18n();
  const { ref, perRow } = useEvenRows(ADD_BAR_ORDER.length);

  const rows: (typeof ADD_BAR_ORDER)[number][][] = [];
  for (let i = 0; i < ADD_BAR_ORDER.length; i += perRow) {
    rows.push(ADD_BAR_ORDER.slice(i, i + perRow));
  }

  return (
    <div className={`${s.wrap} no-print`}>
      <div className={s.label}>
        <span className={s.rule} />
        <Plus size={16} aria-hidden />
        <span className={s.labelText}>{t("addbar.title")}</span>
        <span className={s.rule} />
      </div>
      <div className={s.rows} ref={ref}>
        {rows.map((row, ri) => (
          <div className={s.row} key={ri}>
            {row.map((kind) => {
              const view = cellRegistry[kind];
              const Icon = view.icon;
              return (
                <button
                  key={kind}
                  type="button"
                  className={s.addBtn}
                  style={
                    {
                      "--c": `var(${view.hue.base})`,
                      "--ct": `var(${view.hue.tint})`,
                    } as CSSProperties
                  }
                  aria-label={t(view.addLabelKey)}
                  title={t(view.addLabelKey)}
                  onClick={() => setEditing(addCell(kind))}
                >
                  <Icon size={24} aria-hidden />
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
