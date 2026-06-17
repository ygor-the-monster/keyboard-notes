import { useEffect } from "react";
import { useStore } from "../../providers/StoreProvider/StoreProvider.jsx";
import { useEditing } from "../../providers/EditingProvider/EditingProvider.jsx";
import { useDialog } from "../../providers/DialogProvider/DialogProvider.jsx";
import { useI18n } from "../../providers/I18nProvider/I18nProvider.jsx";
import Topbar from "../Topbar/Topbar.jsx";
import Cell from "../Cell/Cell.jsx";
import EmptyState from "../EmptyState/EmptyState.jsx";
import AddBar from "../AddBar/AddBar.jsx";
import Metronome from "../Metronome/Metronome.jsx";
import Tuner from "../Tuner/Tuner.jsx";
import Drone from "../Drone/Drone.jsx";
import Scratchpad from "../Scratchpad/Scratchpad.jsx";
import SyntaxRef from "../SyntaxRef/SyntaxRef.jsx";
import ChordBuilder from "../ChordBuilder/ChordBuilder.jsx";
import shared from "../../providers/ThemeProvider/ThemeProvider.module.css";
import s from "./App.module.css";

const OVERLAY_SELECTOR =
  "[data-react-aria-top-layer], [role=dialog], [role=listbox], [role=menu], [role=presentation]";

// Each cell type's rainbow hue (mirrors Cell.module.css). Gold is pale, so the undo button
// uses its -strong variant to stay legible on the dark toast.
const TYPE_HUE = { abc: "magenta", cifra: "cinnamon", snd: "gold", img: "seafoam", pdf: "blue", md: "purple" };
const undoAccent = (deleted) => {
  const hue = TYPE_HUE[deleted?.cell?.type] || "magenta";
  return {
    "--accent": `var(--s-${hue === "gold" ? "gold-strong" : hue})`,
    "--accent-strong": `var(--s-${hue}-strong)`,
  };
};

export default function App() {
  const { activeNotebook, createNotebook, importNotebook, hydrated, lastDeleted, undoDelete, dismissUndo } =
    useStore();
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
    if (!("launchQueue" in window)) return;
    window.launchQueue.setConsumer(async (params) => {
      for (const handle of params.files || []) {
        try {
          const file = await handle.getFile();
          importNotebook(JSON.parse(await file.text()));
        } catch (err) {
          alert({ title: t("dialogs.openFileFailedTitle"), message: err.message });
        }
      }
    });
  }, [importNotebook, alert, t]);

  // Android Web Share Target — the service worker stashes the shared file and redirects here.
  useEffect(() => {
    if (!window.location.search.includes("share-target")) return;
    (async () => {
      try {
        const cache = await caches.open("shared-inbox");
        const res = await cache.match("lesson");
        if (res) {
          importNotebook(JSON.parse(await res.text()));
          await cache.delete("lesson");
        }
      } catch (err) {
        alert({ title: t("dialogs.openSharedFailedTitle"), message: err.message });
      }
      window.history.replaceState(null, "", "./");
    })();
  }, [importNotebook, alert, t]);

  // Click-to-edit / click-away-to-render (Jupyter-style active cell).
  useEffect(() => {
    function onDown(e) {
      const cellEl = e.target.closest?.("[data-cell-id]");
      if (cellEl) setEditing(cellEl.dataset.cellId);
      else if (!e.target.closest?.(OVERLAY_SELECTOR)) setEditing(null);
    }
    document.addEventListener("mousedown", onDown, true);
    return () => document.removeEventListener("mousedown", onDown, true);
  }, [setEditing]);

  return (
    <div className="app-shell">
      <Topbar />
      {/* Each dock wears the colour of the cell it relates to (a distinct one each), ordered
          to follow the cell rainbow: Metronome→Score(magenta) · Tuner→Chords(cinnamon) ·
          Drone→Audio(gold) · Reference→Image(seafoam) · Scratchpad→PDF(blue) ·
          Syntax→Note(purple). */}
      <div className={`${s.utilityDock} no-print`}>
        <Metronome />
        <Tuner />
        <Drone />
        <ChordBuilder />
        <Scratchpad />
        <SyntaxRef />
      </div>
      <div className="app-scroll">
        {!hydrated ? null : activeNotebook ? (
          <div className={s.page}>
            {activeNotebook.cells.length === 0 ? (
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
                {activeNotebook.cells.map((cell, i) => (
                  <Cell key={cell.id} cell={cell} index={i} />
                ))}
              </div>
            )}
            <AddBar />
          </div>
        ) : (
          <div className={s.empty}>
            <EmptyState kind="general" neutral title={t("app.noLessonOpen")}>
              <button type="button" className={shared.btnMagenta} onClick={createNotebook}>
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
