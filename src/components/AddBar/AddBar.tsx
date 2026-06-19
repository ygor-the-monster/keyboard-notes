import { type CSSProperties } from "react";
import { PlusIcon as Plus } from "@phosphor-icons/react";
import { useStore } from "../../providers/StoreProvider/StoreProvider.tsx";
import { useEditing } from "../../providers/EditingProvider/EditingProvider.tsx";
import { useI18n } from "../../providers/I18nProvider/I18nProvider.tsx";
import { cellRegistry, ADD_BAR_ORDER } from "../../utils/cellRegistry/cellRegistry.tsx";
import s from "./AddBar.module.css";

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
    </div>
  );
}
