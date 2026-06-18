import { useEffect, type CSSProperties } from "react";
import { useStore } from "../../providers/StoreProvider/StoreProvider.tsx";
import { useEditing } from "../../providers/EditingProvider/EditingProvider.tsx";
import { useDialog } from "../../providers/DialogProvider/DialogProvider.tsx";
import { useI18n } from "../../providers/I18nProvider/I18nProvider.tsx";
import Topbar from "../Topbar/Topbar.tsx";
import Cell from "../Cell/Cell.tsx";
import EmptyState from "../EmptyState/EmptyState.tsx";
import AddBar from "../AddBar/AddBar.tsx";
import Metronome from "../Metronome/Metronome.tsx";
import Tuner from "../Tuner/Tuner.tsx";
import Drone from "../Drone/Drone.tsx";
import Scratchpad from "../Scratchpad/Scratchpad.tsx";
import SyntaxRef from "../SyntaxRef/SyntaxRef.tsx";
import ChordBuilder from "../ChordBuilder/ChordBuilder.tsx";
import type { Cell as CellModel } from "../../utils/cellKinds/cellKinds.ts";
import shared from "../../providers/ThemeProvider/ThemeProvider.module.css";
import s from "./App.module.css";

const OVERLAY_SELECTOR =
  "[data-react-aria-top-layer], [role=dialog], [role=listbox], [role=menu], [role=presentation]";

// Each Cell kind's rainbow hue (mirrors Cell.module.css). Gold is pale, so the undo button uses
// its -strong variant to stay legible on the dark toast.
const TYPE_HUE: Record<string, string> = {
  score: "magenta",
  cifra: "cinnamon",
  audio: "gold",
  image: "seafoam",
  pdf: "blue",
  note: "purple",
};
const undoAccent = (deleted: { cell: CellModel } | null): CSSProperties => {
  const hue = TYPE_HUE[deleted?.cell?.kind ?? ""] || "magenta";
  return {
    "--accent": `var(--s-${hue === "gold" ? "gold-strong" : hue})`,
    "--accent-strong": `var(--s-${hue}-strong)`,
  } as CSSProperties;
};

export default function App() {
  const {
    activeLesson,
    createLesson,
    importLesson,
    hydrated,
    lastDeleted,
    undoDelete,
    dismissUndo,
  } = useStore();
  const { setEditing } = useEditing();
  const { alert } = useDialog();
  const { t } = useI18n();

  // Auto-dismiss the "cell deleted — undo" affordance after a few seconds.
  useEffect(() => {
    if (!lastDeleted) return;
    const id = setTimeout(() => dismissUndo(), 7000);
    return () => clearTimeout(id);
  }, [lastDeleted, dismissUndo]);

  // PWA file handling — open .pnotes files launched from the OS (Chromium desktop, installed).
  useEffect(() => {
    interface LaunchParams {
      files: FileSystemFileHandle[];
    }
    const wq = (
      window as Window & {
        launchQueue?: { setConsumer(cb: (params: LaunchParams) => void): void };
      }
    ).launchQueue;
    if (!wq) return;
    wq.setConsumer(async (params) => {
      for (const handle of params.files || []) {
        try {
          const file = await handle.getFile();
          importLesson(JSON.parse(await file.text()));
        } catch (err) {
          alert({ title: t("dialogs.openFileFailedTitle"), message: (err as Error).message });
        }
      }
    });
  }, [importLesson, alert, t]);

  // Android Web Share Target — the service worker stashes the shared file and redirects here.
  useEffect(() => {
    if (!window.location.search.includes("share-target")) return;
    (async () => {
      try {
        const cache = await caches.open("shared-inbox");
        const res = await cache.match("lesson");
        if (res) {
          importLesson(JSON.parse(await res.text()));
          await cache.delete("lesson");
        }
      } catch (err) {
        alert({ title: t("dialogs.openSharedFailedTitle"), message: (err as Error).message });
      }
      window.history.replaceState(null, "", "./");
    })();
  }, [importLesson, alert, t]);

  // Click-to-edit / click-away-to-render (Jupyter-style active cell).
  useEffect(() => {
    function onDown(e: MouseEvent) {
      const target = e.target as Element;
      const cellEl = target.closest?.("[data-cell-id]");
      if (cellEl) setEditing((cellEl as HTMLElement).dataset.cellId ?? null);
      else if (!target.closest?.(OVERLAY_SELECTOR)) setEditing(null);
    }
    document.addEventListener("mousedown", onDown, true);
    return () => document.removeEventListener("mousedown", onDown, true);
  }, [setEditing]);

  return (
    <div className="app-shell">
      <Topbar />
      {/* Each dock wears the colour of the cell it relates to, ordered to follow the cell rainbow. */}
      <div className={`${s.utilityDock} no-print`}>
        <Metronome />
        <Tuner />
        <Drone />
        <ChordBuilder />
        <Scratchpad />
        <SyntaxRef />
      </div>
      <div className="app-scroll">
        {!hydrated ? null : activeLesson ? (
          <div className={s.page}>
            {activeLesson.cells.length === 0 ? (
              <div className={s.emptyCells}>
                <EmptyState
                  kind="general"
                  neutral
                  title={t("app.emptyLesson")}
                  hint={t("app.emptyLessonHint")}
                />
              </div>
            ) : (
              <div className={s.stack}>
                {activeLesson.cells.map((cell, i) => (
                  <Cell key={cell.id} cell={cell} index={i} />
                ))}
              </div>
            )}
            <AddBar />
          </div>
        ) : (
          <div className={s.empty}>
            <EmptyState kind="general" neutral title={t("app.noLessonOpen")}>
              <button type="button" className={shared.btnMagenta} onClick={createLesson}>
                {t("app.createFirst")}
              </button>
            </EmptyState>
          </div>
        )}
      </div>
      {lastDeleted && (
        <div className={`${s.undoToast} no-print`} role="status" style={undoAccent(lastDeleted)}>
          <span>{t("undo.deleted")}</span>
          <button type="button" className={s.undoBtn} onClick={undoDelete}>
            {t("undo.action")}
          </button>
        </div>
      )}
    </div>
  );
}
