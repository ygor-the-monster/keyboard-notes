import { useEffect } from "react";
import { IllustratedMessage, Heading, Content } from "@react-spectrum/s2";
import { useStore } from "../../providers/StoreProvider/StoreProvider.jsx";
import { useEditing } from "../../providers/EditingProvider/EditingProvider.jsx";
import { useDialog } from "../../providers/DialogProvider/DialogProvider.jsx";
import Topbar from "../Topbar/Topbar.jsx";
import Cell from "../Cell/Cell.jsx";
import AddBar from "../AddBar/AddBar.jsx";
import Metronome from "../Metronome/Metronome.jsx";
import Tuner from "../Tuner/Tuner.jsx";
import shared from "../../providers/ThemeProvider/ThemeProvider.module.css";
import s from "./App.module.css";

const OVERLAY_SELECTOR =
  "[data-react-aria-top-layer], [role=dialog], [role=listbox], [role=menu], [role=presentation]";

export default function App() {
  const { activeNotebook, createNotebook, importNotebook } = useStore();
  const { setEditing } = useEditing();
  const { alert } = useDialog();

  // PWA file handling — open .pnotes files launched from the OS (Chromium desktop, installed).
  useEffect(() => {
    if (!("launchQueue" in window)) return;
    window.launchQueue.setConsumer(async (params) => {
      for (const handle of params.files || []) {
        try {
          const file = await handle.getFile();
          importNotebook(JSON.parse(await file.text()));
        } catch (err) {
          alert({ title: "Couldn't open file", message: err.message });
        }
      }
    });
  }, [importNotebook, alert]);

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
        alert({ title: "Couldn't open shared file", message: err.message });
      }
      window.history.replaceState(null, "", "./");
    })();
  }, [importNotebook, alert]);

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
      <Metronome />
      <Tuner />
      <div className="app-scroll">
        {activeNotebook ? (
          <div className={s.page}>
            <div className={s.stack}>
              {activeNotebook.cells.map((cell, i) => (
                <Cell key={cell.id} cell={cell} index={i} />
              ))}
            </div>
            <AddBar />
          </div>
        ) : (
          <div className={s.empty}>
            <IllustratedMessage>
              <Heading>No lesson open</Heading>
              <Content>
                <button type="button" className={shared.btnMagenta} onClick={createNotebook}>
                  Create your first lesson
                </button>
              </Content>
            </IllustratedMessage>
          </div>
        )}
      </div>
    </div>
  );
}
