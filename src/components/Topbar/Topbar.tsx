import { useEffect, useRef, type ChangeEvent } from "react";
import {
  MenuTrigger,
  Menu,
  MenuItem,
  MenuSection,
  Popover,
  Button,
  Separator,
  TextField,
  Input,
} from "react-aria-components";
import { toast } from "../Toasts/toasts.ts";
import {
  NotebookIcon as Notebook,
  DownloadSimpleIcon as DownloadSimple,
  ShareNetworkIcon as ShareNetwork,
  PrinterIcon as Printer,
  CloudArrowDownIcon as CloudArrowDown,
  TranslateIcon as Translate,
  MoonIcon as Moon,
  SunIcon as Sun,
  MagnifyingGlassIcon as MagnifyingGlass,
  PresentationIcon as Presentation,
  BroadcastIcon as Broadcast,
} from "@phosphor-icons/react";
import { useStore } from "../../providers/StoreProvider/StoreProvider.tsx";
import { storageEstimate } from "../../providers/StoreProvider/StoreProvider.utils.ts";
import { usePwa } from "../../providers/PWAProvider/PWAProvider.tsx";
import { useDialog } from "../../providers/DialogProvider/DialogProvider.tsx";
import { useI18n } from "../../providers/I18nProvider/I18nProvider.tsx";
import { useTheme, ZOOM_LEVELS } from "../../providers/ThemeProvider/ThemeProvider.tsx";
import { useEditing } from "../../providers/EditingProvider/EditingProvider.tsx";
import { useRoute } from "../../providers/RouteProvider/RouteProvider.tsx";
import { toolRegistry } from "../../utils/toolRegistry/toolRegistry.ts";
import { removeDeleted } from "../../utils/recentlyDeleted/recentlyDeleted.ts";
import {
  serializeLesson,
  serializeLibrary,
  lessonFilename,
} from "../../utils/lessonExport/lessonExport.ts";
import { LIBRARY_SCREEN } from "../LibraryScreen/LibraryScreen.tsx";
import { BEAM_SCREEN } from "../BeamScreen/BeamScreen.tsx";
import IconBtn from "../IconBtn/IconBtn.tsx";
import ic from "../IconBtn/IconBtn.module.css";
import f from "../fields/fields.module.css";
import s from "./Topbar.module.css";

const menuBtn = `${ic.btn} ${ic.sizeL}`;

const mb = (bytes?: number) => (bytes ? (bytes / 1e6).toFixed(1) : "0");

export default function Topbar() {
  const {
    state,
    activeLesson,
    setTitle,
    createLesson,
    selectLesson,
    deleteLesson,
    restoreLesson,
    importLesson,
    importLibrary,
  } = useStore();
  const { canInstall, promptInstall } = usePwa();
  const { alert } = useDialog();
  const { t, locale, setLocale, locales } = useI18n();
  const { scheme, toggle: toggleTheme, zoom, setZoom } = useTheme();
  const { setPerforming } = useEditing();
  const { screen, openScreen } = useRoute();
  // While a tool screen is open, the lesson title isn't editable — swap it for the tool's name.
  const screenTool = screen ? toolRegistry[screen] : undefined;
  const fileRef = useRef<HTMLInputElement>(null);
  const headerRef = useRef<HTMLElement>(null);

  // Publish the bar's live height as --topbar-h so fixed overlays (the left utility dock) can sit
  // below it. The bar is a permanent header (it never scrolls away), but its height changes between
  // the one-row desktop layout and the two-row phone layout — measure rather than hard-code.
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const setVar = () =>
      document.documentElement.style.setProperty("--topbar-h", `${el.offsetHeight}px`);
    setVar();
    const ro = new ResizeObserver(setVar);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // The dropdown is for quick switching, not browsing — show only the 3 most-recently-touched
  // lessons; the full Library screen (ADR-0005) is the browse/organize surface.
  const recentLessons = state.order
    .filter((id) => state.lessons[id])
    .sort((a, b) => state.lessons[b].updated - state.lessons[a].updated)
    .slice(0, 3);

  function onMenuAction(key: string | number) {
    const k = String(key);
    if (k === "__new") createLesson();
    else if (k === "__library") openScreen(LIBRARY_SCREEN);
    else if (k === "__import") fileRef.current?.click();
    else if (k === "__backup") exportBackup();
    else if (k === "__storage") showStorage();
    else if (k === "__delete") {
      // No confirm dialog — deletion is recoverable via the undo toast.
      const removed = activeLesson && deleteLesson(activeLesson.id);
      if (removed)
        toast.neutral(t("toast.lessonDeleted"), {
          actionLabel: t("undo.action"),
          onAction: () => {
            restoreLesson(removed);
            removeDeleted(removed.lesson.id); // also clear it from the Recently Deleted bin
          },
          timeout: 7000,
        });
    } else selectLesson(k);
  }

  // One import handles both a single lesson and a full-library backup (auto-detected).
  function onImportFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result as string);
        if (parsed && parsed.library) {
          const { dropped } = importLibrary(parsed);
          const n = Object.keys(parsed.library.lessons ?? {}).length;
          toast.positive(t("toast.restored", { count: n }));
          if (dropped > 0) toast.neutral(t("toast.importDropped", { count: dropped }));
        } else {
          const { dropped } = importLesson(parsed);
          toast.positive(t("toast.imported"));
          if (dropped > 0) toast.neutral(t("toast.importDropped", { count: dropped }));
        }
      } catch {
        toast.negative(t("dialogs.importFailedTitle"));
      }
    };
    reader.readAsText(file);
  }

  // Whole-library backup — device-local data has no cloud copy, so this is the safety net.
  function exportBackup() {
    const blob = new Blob([serializeLibrary(state)], { type: "application/x-piano-notes" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "keyboard-notes-backup.pnotes";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    toast.positive(t("toast.backedUp"));
  }

  async function showStorage() {
    const { usage, quota, persisted } = await storageEstimate();
    const usageLine =
      usage != null && quota != null
        ? t("storage.usage", { used: mb(usage), quota: mb(quota) })
        : "";
    const persistLine = persisted ? t("storage.persistedYes") : t("storage.persistedNo");
    alert({ title: t("dialogs.storageTitle"), message: `${usageLine}\n\n${persistLine}`.trim() });
  }

  function exportJson() {
    if (!activeLesson) return;
    const blob = new Blob([serializeLesson(activeLesson)], { type: "application/x-piano-notes" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = lessonFilename(activeLesson);
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    toast.positive(t("toast.exported"));
  }

  // Outgoing Web Share (Android-friendly) — hand the lesson file to the OS share sheet.
  // Shared as text/plain since that's reliably on Chrome's shareable-file allowlist.
  const canShareFiles =
    typeof navigator !== "undefined" &&
    navigator.canShare?.({ files: [new File(["{}"], "l.pnotes", { type: "text/plain" })] });

  async function shareLesson() {
    if (!activeLesson) return;
    const file = new File([serializeLesson(activeLesson)], lessonFilename(activeLesson), {
      type: "text/plain",
    });
    try {
      await navigator.share({ files: [file], title: activeLesson.title || "Keyboard Notes lesson" });
      toast.positive(t("toast.shared"));
    } catch (err) {
      if ((err as Error).name !== "AbortError") toast.negative(t("dialogs.shareFailedTitle"));
    }
  }

  return (
    <header ref={headerRef} className={`${s.topbar} no-print`}>
      <div className={s.bar}>
        <span className={s.brandMark} aria-hidden>
          <img className={s.brandLogo} src={`${import.meta.env.BASE_URL}icons/icon-simple.svg`} alt="" />
          <span className={s.brandWord}>Keyboard Notes</span>
        </span>
        <Separator orientation="vertical" className={s.vDivider} />
        <MenuTrigger>
          <Button aria-label={t("topbar.lessons")} className={menuBtn}>
            <Notebook size={22} aria-hidden />
          </Button>
          <Popover className={f.menuPopover}>
            <Menu className={f.menu} onAction={onMenuAction}>
              {recentLessons.length > 0 && (
                <MenuSection>
                  {recentLessons.map((id) => (
                    <MenuItem key={id} id={id} className={f.menuItem}>
                      {state.lessons[id].title || t("topbar.untitled")}
                    </MenuItem>
                  ))}
                </MenuSection>
              )}
              {recentLessons.length > 0 && <Separator className={f.menuSeparator} />}
              <MenuSection>
                <MenuItem id="__library" className={f.menuItem}>
                  {t("topbar.openLibrary")}
                </MenuItem>
                <MenuItem id="__new" className={f.menuItem}>
                  {t("topbar.newLesson")}
                </MenuItem>
                <MenuItem id="__import" className={f.menuItem}>
                  {t("topbar.importLesson")}
                </MenuItem>
                <MenuItem id="__delete" className={f.menuItem}>
                  {t("topbar.deleteLesson")}
                </MenuItem>
              </MenuSection>
              <Separator className={f.menuSeparator} />
              <MenuSection>
                <MenuItem id="__backup" className={f.menuItem}>
                  {t("topbar.exportBackup")}
                </MenuItem>
                <MenuItem id="__storage" className={f.menuItem}>
                  {t("topbar.storage")}
                </MenuItem>
              </MenuSection>
            </Menu>
          </Popover>
        </MenuTrigger>

        {screenTool ? (
          <span className={s.screenTitle}>{t(screenTool.labelKey)}</span>
        ) : (
          <TextField
            aria-label={t("topbar.lessonTitle")}
            value={activeLesson?.title || ""}
            onChange={setTitle}
            isDisabled={!activeLesson}
            className={s.titleField}
          >
            <Input className={s.titleInput} placeholder={t("topbar.untitled")} />
          </TextField>
        )}

        <Separator orientation="vertical" className={s.vDivider} />
        <div className={s.tools} role="toolbar" aria-label={t("topbar.lessonTools")}>
          <MenuTrigger>
            <Button aria-label={t("lang.label")} className={menuBtn}>
              <Translate size={22} aria-hidden />
            </Button>
            <Popover className={f.menuPopover}>
              <Menu
                className={f.menu}
                selectionMode="single"
                selectedKeys={[locale]}
                onAction={(k) => setLocale(String(k))}
              >
                {locales.map((l) => (
                  <MenuItem key={l} id={l} className={f.menuItem}>
                    {t(`lang.${l}`)}
                  </MenuItem>
                ))}
              </Menu>
            </Popover>
          </MenuTrigger>
          <MenuTrigger>
            <Button
              aria-label={t("zoom.label")}
              className={menuBtn}
              // Show the current level on the trigger so it doubles as a status readout.
              data-zoom={zoom !== 1 ? Math.round(zoom * 100) : undefined}
            >
              <MagnifyingGlass size={22} aria-hidden />
            </Button>
            <Popover className={f.menuPopover}>
              <Menu
                className={f.menu}
                selectionMode="single"
                selectedKeys={[String(zoom)]}
                onAction={(k) => setZoom(Number(k))}
              >
                {ZOOM_LEVELS.map((lvl) => (
                  <MenuItem key={lvl} id={String(lvl)} className={f.menuItem}>
                    {Math.round(lvl * 100)}%{lvl === 1 ? ` · ${t("zoom.reset")}` : ""}
                  </MenuItem>
                ))}
              </Menu>
            </Popover>
          </MenuTrigger>
          <IconBtn
            icon={scheme === "dark" ? Sun : Moon}
            label={scheme === "dark" ? t("theme.light") : t("theme.dark")}
            onPress={toggleTheme}
          />
          {activeLesson && (
            <IconBtn
              icon={Presentation}
              label={t("performance.enter")}
              onPress={() => setPerforming(true)}
            />
          )}
          {activeLesson && (
            <IconBtn
              icon={Broadcast}
              label={t("beam.title")}
              onPress={() => openScreen(BEAM_SCREEN)}
            />
          )}
          <IconBtn icon={DownloadSimple} label={t("topbar.exportLesson")} onPress={exportJson} />
          {canShareFiles && (
            <IconBtn icon={ShareNetwork} label={t("topbar.shareLesson")} onPress={shareLesson} />
          )}
          <IconBtn icon={Printer} label={t("topbar.print")} onPress={() => window.print()} />
          {canInstall && (
            <IconBtn icon={CloudArrowDown} label={t("topbar.install")} onPress={promptInstall} />
          )}
        </div>

        <input ref={fileRef} type="file" hidden onChange={onImportFile} />
      </div>
    </header>
  );
}
