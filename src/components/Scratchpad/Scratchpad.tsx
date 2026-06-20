import { useEffect, useRef, useState, type ChangeEvent } from "react";
import {
  NotePencilIcon as NotePencil,
  ArrowsOutSimpleIcon as ArrowsOut,
  PlusIcon as Plus,
  TrashIcon as Trash,
} from "@phosphor-icons/react";
import { useI18n } from "../../providers/I18nProvider/I18nProvider.tsx";
import { useRoute } from "../../providers/RouteProvider/RouteProvider.tsx";
import { getPref, setPref } from "../../providers/StoreProvider/StoreProvider.utils.ts";
import { uid } from "../../utils/cellId/cellId.ts";
import ToolScreen from "../ToolScreen/ToolScreen.tsx";
import shared from "../../providers/ThemeProvider/ThemeProvider.module.css";
import s from "./Scratchpad.module.css";

const SCREEN_ID = "scratchpad";

interface Todo {
  id: string;
  text: string;
  done: boolean;
}

// A pull-tab sticky note — quick reminders / homework, kept out of the cell flow. It's a single
// global pad (not tied to a lesson), so it's always available and survives lesson switches.
// Lightweight, so it lives in localStorage rather than the IndexedDB lesson record. The expanded
// screen gives the text room to breathe and adds a to-do list.
const PREF_KEY = "scratch.global";
const TODO_KEY = "scratchTodos.global";

export default function Scratchpad() {
  const { t } = useI18n();
  const { screen, openScreen, closeScreen } = useRoute();
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(0);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const onScreen = screen === SCREEN_ID;

  // Uncontrolled textarea (keeps native undo); reload it when the surface swaps between the dock
  // card and the screen (a different textarea element mounts).
  useEffect(() => {
    const ta = taRef.current;
    const text = getPref(PREF_KEY, "");
    if (ta) ta.value = text;
    setCount(text.length);
  }, [open, onScreen]);

  // To-do list (screen-only), persisted alongside the note text.
  const [todos, setTodos] = useState<Todo[]>(() => getPref<Todo[]>(TODO_KEY, []));
  const [draft, setDraft] = useState("");
  function saveTodos(next: Todo[]) {
    setTodos(next);
    setPref(TODO_KEY, next);
  }
  function addTodo() {
    const text = draft.trim();
    if (!text) return;
    saveTodos([...todos, { id: uid(), text, done: false }]);
    setDraft("");
  }

  function onAreaChange(e: ChangeEvent<HTMLTextAreaElement>) {
    setPref(PREF_KEY, e.target.value);
    setCount(e.target.value.length);
  }

  const dockClass = [s.dock, "no-print", open && s.open].filter(Boolean).join(" ");

  return (
    <>
      <div className={dockClass}>
        <div className={s.tab}>
          <button
            type="button"
            className={s.tabExpand}
            onClick={() => openScreen(SCREEN_ID)}
            aria-label={`${t("screen.expand")} — ${t("scratch.name")}`}
          >
            <ArrowsOut size={16} aria-hidden />
          </button>
          <button
            type="button"
            className={s.tabToggle}
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-label={open ? t("scratch.hide") : t("scratch.show")}
          >
            <NotePencil size={22} aria-hidden />
            <span className={s.tabLabel}>{t("scratch.name")}</span>
            <span className={s.tabCount}>{count}</span>
          </button>
        </div>

        {!onScreen && (
          <div className={s.card}>
            <div className={s.head}>
              <NotePencil size={18} aria-hidden />
              <span>{t("scratch.name")}</span>
            </div>
            <textarea
              ref={taRef}
              className={s.area}
              placeholder={t("scratch.placeholder")}
              aria-label={t("scratch.name")}
              onChange={onAreaChange}
            />
          </div>
        )}
      </div>

      {onScreen && (
        <ToolScreen
          title={t("scratch.name")}
          icon={NotePencil}
          accent="--s-blue"
          wide
          onClose={closeScreen}
        >
          <div className={s.screenWrap}>
            <textarea
              ref={taRef}
              className={s.screenArea}
              placeholder={t("scratch.placeholder")}
              aria-label={t("scratch.name")}
              onChange={onAreaChange}
            />

            <div className={s.todoSection}>
              <span className={s.fieldLabel}>{t("scratch.todos")}</span>
              <form
                className={s.todoAdd}
                onSubmit={(e) => {
                  e.preventDefault();
                  addTodo();
                }}
              >
                <input
                  className={s.todoInput}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder={t("scratch.todoPlaceholder")}
                  aria-label={t("scratch.addTodo")}
                />
                <button
                  type="submit"
                  className={`${shared.btnMagenta} ${s.todoAddBtn}`}
                  aria-label={t("scratch.addTodo")}
                  disabled={!draft.trim()}
                >
                  <Plus size={18} aria-hidden />
                </button>
              </form>

              {todos.length > 0 && (
                <ul className={s.todoList}>
                  {todos.map((td) => (
                    <li key={td.id} className={s.todoItem}>
                      <label className={s.todoCheck}>
                        <input
                          type="checkbox"
                          className={s.todoBox}
                          checked={td.done}
                          onChange={() =>
                            saveTodos(todos.map((x) => (x.id === td.id ? { ...x, done: !x.done } : x)))
                          }
                        />
                        <span className={td.done ? s.todoDone : s.todoText}>{td.text}</span>
                      </label>
                      <button
                        type="button"
                        className={s.todoDel}
                        aria-label={t("scratch.removeTodo")}
                        onClick={() => saveTodos(todos.filter((x) => x.id !== td.id))}
                      >
                        <Trash size={16} aria-hidden />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </ToolScreen>
      )}
    </>
  );
}
