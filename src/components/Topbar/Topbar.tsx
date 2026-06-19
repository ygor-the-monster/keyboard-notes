import { useRef, type ChangeEvent } from "react";
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
} from "@phosphor-icons/react";
import { useStore } from "../../providers/StoreProvider/StoreProvider.tsx";
import { storageEstimate } from "../../providers/StoreProvider/StoreProvider.utils.ts";
import { usePwa } from "../../providers/PWAProvider/PWAProvider.tsx";
import { useDialog } from "../../providers/DialogProvider/DialogProvider.tsx";
import { useI18n } from "../../providers/I18nProvider/I18nProvider.tsx";
import { useTheme } from "../../providers/ThemeProvider/ThemeProvider.tsx";
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
  const { scheme, toggle: toggleTheme } = useTheme();
  const fileRef = useRef<HTMLInputElement>(null);

  const lessons = state.order.filter((id) => state.lessons[id]);

  function onMenuAction(key: string | number) {
    const k = String(key);
    if (k === "__new") createLesson();
    else if (k === "__import") fileRef.current?.click();
    else if (k === "__backup") exportBackup();
    else if (k === "__storage") showStorage();
    else if (k === "__delete") {
      // No confirm dialog — deletion is recoverable via the undo toast.
      const removed = activeLesson && deleteLesson(activeLesson.id);
      if (removed)
        toast.neutral(t("toast.lessonDeleted"), {
          actionLabel: t("undo.action"),
          onAction: () => restoreLesson(removed),
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
          importLibrary(parsed);
          const n = Object.keys(parsed.library.lessons ?? {}).length;
          toast.positive(t("toast.restored", { count: n }));
        } else {
          importLesson(parsed);
          toast.positive(t("toast.imported"));
        }
      } catch {
        toast.negative(t("dialogs.importFailedTitle"));
      }
    };
    reader.readAsText(file);
  }

  // Whole-library backup — device-local data has no cloud copy, so this is the safety net.
  function exportBackup() {
    const data = JSON.stringify(
      { app: "pianoNotes", version: 3, library: { lessons: state.lessons, order: state.order } },
      null,
      2,
    );
    const blob = new Blob([data], { type: "application/x-piano-notes" });
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

  const lessonJson = () =>
    JSON.stringify({ app: "pianoNotes", version: 3, lesson: activeLesson }, null, 2);
  const lessonFilename = () =>
    (activeLesson?.title || "lesson").replace(/[^\w-]+/g, "_") + ".pnotes";

  function exportJson() {
    if (!activeLesson) return;
    const blob = new Blob([lessonJson()], { type: "application/x-piano-notes" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = lessonFilename();
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
    const file = new File([lessonJson()], lessonFilename(), { type: "text/plain" });
    try {
      await navigator.share({ files: [file], title: activeLesson.title || "Keyboard Notes lesson" });
      toast.positive(t("toast.shared"));
    } catch (err) {
      if ((err as Error).name !== "AbortError") toast.negative(t("dialogs.shareFailedTitle"));
    }
  }

  return (
    <header className={`${s.topbar} no-print`}>
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
              {lessons.length > 0 && (
                <MenuSection>
                  {lessons.map((id) => (
                    <MenuItem key={id} id={id} className={f.menuItem}>
                      {state.lessons[id].title || t("topbar.untitled")}
                    </MenuItem>
                  ))}
                </MenuSection>
              )}
              {lessons.length > 0 && <Separator className={f.menuSeparator} />}
              <MenuSection>
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

        <TextField
          aria-label={t("topbar.lessonTitle")}
          value={activeLesson?.title || ""}
          onChange={setTitle}
          isDisabled={!activeLesson}
          className={s.titleField}
        >
          <Input className={s.titleInput} placeholder={t("topbar.untitled")} />
        </TextField>

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
          <IconBtn
            icon={scheme === "dark" ? Sun : Moon}
            label={scheme === "dark" ? t("theme.light") : t("theme.dark")}
            onPress={toggleTheme}
          />
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
