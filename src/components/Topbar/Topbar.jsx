import { useRef } from "react";
import {
  MenuTrigger,
  Menu,
  MenuItem,
  MenuSection,
  ActionButton,
  TextField,
  Divider,
} from "@react-spectrum/s2";
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
import { vdiv, titleField } from "./Topbar.styled.ts";
import s from "./Topbar.module.css";

const mb = (bytes) => (bytes ? (bytes / 1e6).toFixed(1) : "0");

export default function Topbar() {
  const {
    state,
    activeLesson,
    setTitle,
    createLesson,
    selectLesson,
    deleteLesson,
    importLesson,
    importLibrary,
  } = useStore();
  const { canInstall, promptInstall } = usePwa();
  const { confirm, alert } = useDialog();
  const { t, locale, setLocale, locales } = useI18n();
  const { scheme, toggle: toggleTheme } = useTheme();
  const fileRef = useRef(null);

  const lessons = state.order.filter((id) => state.lessons[id]);

  async function onMenuAction(key) {
    const k = String(key);
    if (k === "__new") createLesson();
    else if (k === "__import") fileRef.current?.click();
    else if (k === "__backup") exportBackup();
    else if (k === "__storage") showStorage();
    else if (k === "__delete") {
      if (
        activeLesson &&
        (await confirm({
          title: t("dialogs.deleteLessonTitle"),
          message: t("dialogs.deleteLessonMsg"),
          confirmLabel: t("common.delete"),
          variant: "destructive",
        }))
      )
        deleteLesson(activeLesson.id);
    } else selectLesson(k);
  }

  // One import handles both a single lesson and a full-library backup (auto-detected).
  function onImportFile(e) {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        if (parsed && parsed.library) importLibrary(parsed);
        else importLesson(parsed);
      } catch (err) {
        alert({ title: t("dialogs.importFailedTitle"), message: err.message });
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
    a.download = "piano-notes-backup.pnotes";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
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
      await navigator.share({ files: [file], title: activeLesson.title || "Piano Notes lesson" });
    } catch (err) {
      if (err.name !== "AbortError")
        alert({ title: t("dialogs.shareFailedTitle"), message: err.message });
    }
  }

  return (
    <header className={`${s.topbar} no-print`}>
      <div className={s.bar}>
        <span className={s.brandMark} aria-hidden>
          <img className={s.brandLogo} src={`${import.meta.env.BASE_URL}icon-simple.svg`} alt="" />
          <span className={s.brandWord}>Piano Notes</span>
        </span>
        <Divider orientation="vertical" styles={vdiv} />
        <MenuTrigger>
          <ActionButton aria-label={t("topbar.lessons")} isQuiet size="L">
            <Notebook size={22} aria-hidden />
          </ActionButton>
          <Menu onAction={onMenuAction}>
            <MenuSection>
              {lessons.map((id) => (
                <MenuItem key={id} id={id}>
                  {state.lessons[id].title || t("topbar.untitled")}
                </MenuItem>
              ))}
            </MenuSection>
            <MenuSection>
              <MenuItem id="__new">{t("topbar.newLesson")}</MenuItem>
              <MenuItem id="__import">{t("topbar.importLesson")}</MenuItem>
              <MenuItem id="__delete">{t("topbar.deleteLesson")}</MenuItem>
            </MenuSection>
            <MenuSection>
              <MenuItem id="__backup">{t("topbar.exportBackup")}</MenuItem>
              <MenuItem id="__storage">{t("topbar.storage")}</MenuItem>
            </MenuSection>
          </Menu>
        </MenuTrigger>

        <TextField
          aria-label={t("topbar.lessonTitle")}
          placeholder={t("topbar.untitled")}
          value={activeLesson?.title || ""}
          onChange={setTitle}
          isDisabled={!activeLesson}
          styles={titleField}
        />

        <Divider orientation="vertical" styles={vdiv} />
        <div className={s.tools} role="toolbar" aria-label={t("topbar.lessonTools")}>
          <MenuTrigger>
            <ActionButton aria-label={t("lang.label")} isQuiet size="L">
              <Translate size={22} aria-hidden />
            </ActionButton>
            <Menu
              selectionMode="single"
              selectedKeys={[locale]}
              onAction={(k) => setLocale(String(k))}
            >
              {locales.map((l) => (
                <MenuItem key={l} id={l}>
                  {t(`lang.${l}`)}
                </MenuItem>
              ))}
            </Menu>
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
