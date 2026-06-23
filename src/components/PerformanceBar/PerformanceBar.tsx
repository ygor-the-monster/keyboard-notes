import { Button } from "react-aria-components";
import { XIcon as X } from "@phosphor-icons/react";
import { useI18n } from "../../providers/I18nProvider/I18nProvider.tsx";
import s from "./PerformanceBar.module.css";

// The one piece of chrome that stays visible in performance ("present") mode: a slim floating
// control to read the lesson title and step back out. Everything else is hidden so the lesson fills
// the screen. Exiting is also bound to Escape (in App).
export default function PerformanceBar({ title, onExit }: { title: string; onExit: () => void }) {
  const { t } = useI18n();
  return (
    <div className={s.bar}>
      <span className={s.title}>{title}</span>
      <Button className={s.exit} onPress={onExit} aria-label={t("performance.exit")}>
        <X size={18} weight="bold" aria-hidden /> {t("performance.exit")}
      </Button>
    </div>
  );
}
