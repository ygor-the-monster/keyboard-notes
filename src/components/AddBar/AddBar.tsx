import { type CSSProperties } from "react";
import { Plus } from "@phosphor-icons/react";
import { useStore } from "../../providers/StoreProvider/StoreProvider.tsx";
import { useEditing } from "../../providers/EditingProvider/EditingProvider.jsx";
import { useI18n } from "../../providers/I18nProvider/I18nProvider.jsx";
import { cellRegistry, ADD_BAR_ORDER } from "../../cells/registry.tsx";
import s from "./AddBar.module.css";

export default function AddBar() {
  const { addCell } = useStore();
  // Loose casts for providers still on .jsx — removed when they migrate to TS.
  const { setEditing } = useEditing() as unknown as { setEditing: (id: string) => void };
  const { t } = useI18n() as unknown as { t: (key: string) => string };
  return (
    <div className={`${s.wrap} no-print`}>
      <div className={s.label}>
        <span className={s.rule} />
        <Plus size={16} aria-hidden />
        <span className={s.labelText}>{t("addbar.title")}</span>
        <span className={s.rule} />
      </div>
      <div className={s.row}>
        {ADD_BAR_ORDER.map((kind) => {
          const view = cellRegistry[kind];
          const Icon = view.icon;
          return (
            <button
              key={kind}
              type="button"
              className={s.addBtn}
              style={
                {
                  "--c": `var(${view.accent.c})`,
                  "--ct": `var(${view.accent.ct})`,
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
    </div>
  );
}
