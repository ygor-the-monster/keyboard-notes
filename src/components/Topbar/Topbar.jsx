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
import { Notebook, DownloadSimple, Printer, CloudArrowDown } from "@phosphor-icons/react";
import { useStore } from "../../providers/StoreProvider/StoreProvider.jsx";
import { usePwa } from "../../providers/PWAProvider/PWAProvider.jsx";
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
  const fileRef = useRef(null);

  const lessons = state.order.filter((id) => state.notebooks[id]);

  function onMenuAction(key) {
    const k = String(key);
    if (k === "__new") createNotebook();
    else if (k === "__import") fileRef.current?.click();
    else if (k === "__delete") {
      if (activeNotebook && confirm("Delete this lesson? This cannot be undone."))
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
        alert("Import failed: " + err.message);
      }
    };
    reader.readAsText(file);
  }

  function exportJson() {
    if (!activeNotebook) return;
    const data = JSON.stringify(
      { app: "pianoNotes", version: 2, notebook: activeNotebook },
      null,
      2,
    );
    const blob = new Blob([data], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = (activeNotebook.title || "lesson").replace(/[^\w-]+/g, "_") + ".json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
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
              <MenuItem id="__import">Import lesson (.json)…</MenuItem>
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
          <IconBtn icon={DownloadSimple} label="Export JSON" onPress={exportJson} />
          <IconBtn icon={Printer} label="Print / save PDF" onPress={() => window.print()} />
          {canInstall && (
            <IconBtn icon={CloudArrowDown} label="Install app" onPress={promptInstall} />
          )}
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={onImportFile}
        />
      </div>
    </header>
  );
}
