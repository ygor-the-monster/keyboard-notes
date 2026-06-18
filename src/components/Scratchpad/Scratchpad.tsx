import { useEffect, useRef, useState } from "react";
import { NotePencilIcon as NotePencil } from "@phosphor-icons/react";
import { useStore } from "../../providers/StoreProvider/StoreProvider.tsx";
import { useI18n } from "../../providers/I18nProvider/I18nProvider.tsx";
import { getPref, setPref } from "../../providers/StoreProvider/StoreProvider.utils.ts";
import s from "./Scratchpad.module.css";

// A pull-tab sticky note for the active lesson — quick reminders / homework, kept out of
// the cell flow. Lightweight, so it lives in localStorage (keyed per lesson) rather than
// in the IndexedDB lesson record.
export default function Scratchpad() {
  const { activeLesson } = useStore();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(0);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const id = activeLesson?.id;
  const prefKey = id ? "scratch." + id : null;

  // Uncontrolled textarea (keeps native undo); reload it whenever the active lesson changes.
  useEffect(() => {
    const ta = taRef.current;
    const text = prefKey ? getPref(prefKey, "") : "";
    if (ta) ta.value = text;
    setCount(text.length);
  }, [prefKey, open]);

  const dockClass = [s.dock, "no-print", open && s.open].filter(Boolean).join(" ");

  return (
    <div className={dockClass}>
      <button
        type="button"
        className={s.tab}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={open ? t("scratch.hide") : t("scratch.show")}
      >
        <NotePencil size={22} aria-hidden />
        <span className={s.tabLabel}>{t("scratch.name")}</span>
        <span className={s.tabCount}>{count}</span>
      </button>

      <div className={s.card}>
        <div className={s.head}>
          <NotePencil size={18} aria-hidden />
          <span>{t("scratch.name")}</span>
        </div>
        <textarea
          ref={taRef}
          className={s.area}
          placeholder={t("scratch.placeholder")}
          aria-label={t("scratch.name")}
          onChange={(e) => {
            if (prefKey) setPref(prefKey, e.target.value);
            setCount(e.target.value.length);
          }}
          disabled={!activeLesson}
        />
      </div>
    </div>
  );
}
