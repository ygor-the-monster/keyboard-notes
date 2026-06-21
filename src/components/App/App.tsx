import { useEffect, useRef, useState } from "react";
import { useStore } from "../../providers/StoreProvider/StoreProvider.tsx";
import { setSaveErrorHandler, usePref } from "../../providers/StoreProvider/StoreProvider.utils.ts";
import { usePwa } from "../../providers/PWAProvider/PWAProvider.tsx";
import { useReorderFlip } from "../../hooks/useReorderFlip.ts";
import { useWakeLock } from "../../hooks/useWakeLock.ts";
import Toasts from "../Toasts/Toasts.tsx";
import { toast } from "../Toasts/toasts.ts";
import { useEditing } from "../../providers/EditingProvider/EditingProvider.tsx";
import { useI18n } from "../../providers/I18nProvider/I18nProvider.tsx";
import { useRoute } from "../../providers/RouteProvider/RouteProvider.tsx";
import { toolRegistry } from "../../utils/toolRegistry/toolRegistry.ts";
import Topbar from "../Topbar/Topbar.tsx";
import Cell from "../Cell/Cell.tsx";
import EmptyState from "../EmptyState/EmptyState.tsx";
import AddBar from "../AddBar/AddBar.tsx";
import Metronome from "../Metronome/Metronome.tsx";
import Tuner from "../Tuner/Tuner.tsx";
import Drone from "../Drone/Drone.tsx";
import Scratchpad from "../Scratchpad/Scratchpad.tsx";
import GoalTimer from "../GoalTimer/GoalTimer.tsx";
import SyntaxRef from "../SyntaxRef/SyntaxRef.tsx";
import ChordBuilder from "../ChordBuilder/ChordBuilder.tsx";
import CellRail from "../CellRail/CellRail.tsx";
import LibraryScreen from "../LibraryScreen/LibraryScreen.tsx";
import shared from "../../providers/ThemeProvider/ThemeProvider.module.css";
import s from "./App.module.css";

const OVERLAY_SELECTOR =
  "[data-react-aria-top-layer], [role=dialog], [role=listbox], [role=menu], [role=presentation]";

export default function App() {
  const { activeLesson, createLesson, importLesson, hydrated } = useStore();
  const { setEditing } = useEditing();
  const { canInstall, promptInstall } = usePwa();
  const { t } = useI18n();
  const { openScreen } = useRoute();

  // Keep the screen awake while a lesson is open — the user is reading notation at the piano with
  // their hands busy. Auto-released when the tab is backgrounded, so it never drains battery idle.
  useWakeLock(!!activeLesson);

  // Slide cells into place when the order changes (drag-reorder or the ▲▼ buttons). Cells animate in
  // on mount via CSS (.cell cell-in); this FLIP handles reorder. Only touches [data-cell-id], so the
  // drag ghost is never animated.
  const stackRef = useRef<HTMLDivElement>(null);
  useReorderFlip(stackRef, activeLesson?.cells.map((c) => c.id).join("|") ?? "");

  // Surface a failed persist (quota exceeded / IndexedDB unavailable) as a toast. Wired here (not in
  // the store) so StoreProvider stays free of S2 and unit-testable in jsdom. The util de-dupes.
  useEffect(() => {
    setSaveErrorHandler(() => toast.negative(t("toast.saveFailed")));
    return () => setSaveErrorHandler(null);
  }, [t]);

  // Manifest shortcuts arrive as query params on launch. Capture them once at first render (before
  // we scrub the URL), then act: ?new=1 creates a lesson; ?tool=… targets a utility tool. A plain
  // launch restores the last active lesson — the store's default.
  const [launch] = useState(() => {
    const p = new URLSearchParams(window.location.search);
    return { newLesson: p.get("new") === "1", tool: p.get("tool") };
  });
  useEffect(() => {
    if (hydrated && launch.newLesson) createLesson();
  }, [hydrated, launch.newLesson, createLesson]);
  // A tool shortcut opens that tool's full screen if it has one (still autostarts via the `autostart`
  // prop below); tools without a screen just autostart their dock.
  useEffect(() => {
    if (launch.tool && toolRegistry[launch.tool]) openScreen(launch.tool);
  }, [launch.tool, openScreen]);
  // Scrub the one-shot query so a refresh doesn't repeat it — but keep any screen hash openScreen set.
  useEffect(() => {
    if (launch.newLesson || launch.tool) {
      window.history.replaceState(
        window.history.state,
        "",
        window.location.pathname + window.location.hash,
      );
    }
  }, [launch]);

  // Encourage installing the app, once — installing is what protects lessons from being cleared
  // (Chromium grants persistent storage to installed apps; iOS exempts Home-Screen apps from its
  // 7-day storage wipe). Shown only when not already installed and never nagged before.
  const [installNudged, setInstallNudged] = usePref("pwa.installNudged", false);
  useEffect(() => {
    if (installNudged || window.matchMedia("(display-mode: standalone)").matches) return;
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    // Chromium fires beforeinstallprompt (canInstall) and lets us trigger the prompt directly; iOS
    // never does, so we can only instruct the user to add it from the Share sheet.
    if (canInstall) {
      setInstallNudged(true);
      toast.neutral(t("toast.installPrompt"), {
        actionLabel: t("toast.installAction"),
        onAction: () => void promptInstall(),
      });
    } else if (isIos) {
      setInstallNudged(true);
      toast.neutral(t("toast.installIos"));
    }
  }, [canInstall, installNudged, setInstallNudged, promptInstall, t]);

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
        } catch {
          toast.negative(t("dialogs.openFileFailedTitle"));
        }
      }
    });
  }, [importLesson, t]);

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
      } catch {
        toast.negative(t("dialogs.openSharedFailedTitle"));
      }
      window.history.replaceState(null, "", "./");
    })();
  }, [importLesson, t]);

  // Click-to-edit / click-away-to-render (Jupyter-style active cell).
  useEffect(() => {
    function onDown(e: MouseEvent) {
      const target = e.target as Element;
      const cellEl = target.closest?.("[data-cell-id]");
      if (cellEl) setEditing((cellEl as HTMLElement).dataset.cellId ?? null);
      // The cell rail focuses a card itself (and isn't an overlay) — don't treat it as click-away.
      else if (!target.closest?.(OVERLAY_SELECTOR) && !target.closest?.("[data-cell-rail]"))
        setEditing(null);
    }
    document.addEventListener("mousedown", onDown, true);
    return () => document.removeEventListener("mousedown", onDown, true);
  }, [setEditing]);

  return (
    <div className="app-shell">
      <Topbar />
      {/* Left-edge utility docks (moved off the right to make room for the cell rail by the
          scrollbar). Each dock wears the colour of the cell it relates to. */}
      <div className={`${s.utilityDock} no-print`}>
        <Metronome autostart={launch.tool === "metronome"} />
        <Tuner autostart={launch.tool === "tuner"} />
        <Drone />
        <ChordBuilder />
        <Scratchpad />
        <SyntaxRef />
        <GoalTimer />
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
              <div className={s.stack} ref={stackRef}>
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
      <CellRail />
      <LibraryScreen />
      <Toasts />
    </div>
  );
}
