import { type CSSProperties, type ReactNode, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { ArrowLeftIcon as ArrowLeft, type Icon } from "@phosphor-icons/react";
import { useI18n } from "../../providers/I18nProvider/I18nProvider.tsx";
import s from "./ToolScreen.module.css";

// Full-page screen for a utility tool. Renders below the (still-visible) topbar and over the
// lesson + docks. Not a modal — the topbar stays interactive — so it's a labelled region, not a
// dialog: Escape closes it and focus moves to the Back control on open. The tool keeps a single
// mounted instance (the dock swaps to this layout), so audio/timers carry across the transition.
interface ToolScreenProps {
  title: string;
  icon: Icon;
  /** Accent token base from toolRegistry, e.g. "--s-magenta". */
  accent: string;
  onClose: () => void;
  children: ReactNode;
}

export default function ToolScreen({ title, icon: Icon, accent, onClose, children }: ToolScreenProps) {
  const { t } = useI18n();
  const backRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    backRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return createPortal(
    <section
      className={`${s.screen} no-print`}
      style={{ "--screen-accent": `var(${accent})` } as CSSProperties}
      role="region"
      aria-label={title}
    >
      <div className={s.head}>
        <button ref={backRef} type="button" className={s.back} onClick={onClose}>
          <ArrowLeft size={20} aria-hidden />
          {t("screen.back")}
        </button>
        <span className={s.title}>
          <Icon size={22} weight="fill" aria-hidden />
          {title}
        </span>
      </div>
      <div className={s.body}>{children}</div>
    </section>,
    document.body,
  );
}
