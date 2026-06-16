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
  Notebook,
  DownloadSimple,
  ShareNetwork,
  Printer,
  CloudArrowDown,
} from "@phosphor-icons/react";
import { useStore } from "../../providers/StoreProvider/StoreProvider.jsx";
import { usePwa } from "../../providers/PWAProvider/PWAProvider.jsx";
import { useDialog } from "../../providers/DialogProvider/DialogProvider.jsx";
import IconBtn from "../IconBtn/IconBtn.jsx";
import { vdiv, titleField } from "./Topbar.styled.jsx";
import s from "./Topbar.module.css";

export default function Topbar() {
  const {
    state,
    activeNotebook,
    setTitle,
    createNotebook,
    selectNotebook,
    deleteNotebook,
    importNotebook,
  } = useStore();
  const { canInstall, promptInstall } = usePwa();
  const { confirm, alert } = useDialog();
  const fileRef = useRef(null);

  const lessons = state.order.filter((id) => state.notebooks[id]);

  async function onMenuAction(key) {
    const k = String(key);
    if (k === "__new") createNotebook();
    else if (k === "__import") fileRef.current?.click();
    else if (k === "__delete") {
      if (
        activeNotebook &&
        (await confirm({
          title: "Delete this lesson?",
          message: "This cannot be undone.",
          confirmLabel: "Delete",
          variant: "destructive",
        }))
      )
        deleteNotebook(activeNotebook.id);
    } else selectNotebook(k);
  }

  function onImportFile(e) {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        importNotebook(JSON.parse(reader.result));
      } catch (err) {
        alert({ title: "Import failed", message: err.message });
      }
    };
    reader.readAsText(file);
  }

  const lessonJson = () =>
    JSON.stringify({ app: "pianoNotes", version: 2, notebook: activeNotebook }, null, 2);
  const lessonFilename = () =>
    (activeNotebook?.title || "lesson").replace(/[^\w-]+/g, "_") + ".pnotes";

  function exportJson() {
    if (!activeNotebook) return;
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
    if (!activeNotebook) return;
    const file = new File([lessonJson()], lessonFilename(), { type: "text/plain" });
    try {
      await navigator.share({ files: [file], title: activeNotebook.title || "Piano Notes lesson" });
    } catch (err) {
      if (err.name !== "AbortError") alert({ title: "Share failed", message: err.message });
    }
  }

  return (
    <header className={`${s.topbar} no-print`}>
      <div className={s.bar}>
        <span className={s.brandMark} aria-hidden>
          <span className={s.brandGlyph}>𝄞</span>
          <span className={s.brandWord}>Piano Notes</span>
        </span>
        <Divider orientation="vertical" styles={vdiv} />
        <MenuTrigger>
          <ActionButton aria-label="Lessons" isQuiet size="L">
            <Notebook size={22} aria-hidden />
          </ActionButton>
          <Menu onAction={onMenuAction}>
            <MenuSection>
              {lessons.map((id) => (
                <MenuItem key={id} id={id}>
                  {state.notebooks[id].title || "Untitled lesson"}
                </MenuItem>
              ))}
            </MenuSection>
            <MenuSection>
              <MenuItem id="__new">New lesson</MenuItem>
              <MenuItem id="__import">Import lesson…</MenuItem>
              <MenuItem id="__delete">Delete this lesson</MenuItem>
            </MenuSection>
          </Menu>
        </MenuTrigger>

        <TextField
          aria-label="Lesson title"
          placeholder="Untitled lesson"
          value={activeNotebook?.title || ""}
          onChange={setTitle}
          isDisabled={!activeNotebook}
          styles={titleField}
        />

        <Divider orientation="vertical" styles={vdiv} />
        <div className={s.tools} role="toolbar" aria-label="Lesson tools">
          <IconBtn icon={DownloadSimple} label="Export lesson" onPress={exportJson} />
          {canShareFiles && (
            <IconBtn icon={ShareNetwork} label="Share lesson" onPress={shareLesson} />
          )}
          <IconBtn icon={Printer} label="Print / save PDF" onPress={() => window.print()} />
          {canInstall && (
            <IconBtn icon={CloudArrowDown} label="Install app" onPress={promptInstall} />
          )}
        </div>

        <input ref={fileRef} type="file" hidden onChange={onImportFile} />
      </div>
    </header>
  );
}
