import { useState } from "react";
import {
  Button,
  MenuTrigger,
  Menu,
  MenuItem,
  Popover,
  TextField,
  Input,
} from "react-aria-components";
import {
  BooksIcon as Books,
  MagnifyingGlassIcon as MagnifyingGlass,
  SortAscendingIcon as SortAscending,
  PlusIcon as Plus,
} from "@phosphor-icons/react";
import { useRoute } from "../../providers/RouteProvider/RouteProvider.tsx";
import { useStore } from "../../providers/StoreProvider/StoreProvider.tsx";
import { useI18n } from "../../providers/I18nProvider/I18nProvider.tsx";
import { toast } from "../Toasts/toasts.ts";
import { selectLibraryView, type LibrarySort } from "../../utils/libraryView/libraryView.ts";
import { serializeLesson, lessonFilename } from "../../utils/lessonExport/lessonExport.ts";
import type { Lesson } from "../../utils/cellKinds/cellKinds.ts";
import ToolScreen from "../ToolScreen/ToolScreen.tsx";
import EmptyState from "../EmptyState/EmptyState.tsx";
import LessonCard from "./LessonCard.tsx";
import f from "../fields/fields.module.css";
import s from "./LibraryScreen.module.css";

export const LIBRARY_SCREEN = "library";

const SORTS: LibrarySort[] = ["recent", "title", "created"];

function downloadLesson(lesson: Lesson) {
  const blob = new Blob([serializeLesson(lesson)], { type: "application/x-piano-notes" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = lessonFilename(lesson);
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// The full-screen Library (ADR-0005). Always mounted; renders its screen only when the route is on
// `#library`, mirroring how the Pull Tab tools gate their expanded screens.
export default function LibraryScreen() {
  const { screen, closeScreen } = useRoute();
  const { state, selectLesson, createLesson, togglePin, setLessonTags, deleteLesson, restoreLesson } =
    useStore();
  const { t } = useI18n();

  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<LibrarySort>("recent");
  const [activeTag, setActiveTag] = useState<string | null>(null);

  if (screen !== LIBRARY_SCREEN) return null;

  const now = Date.now();
  const view = selectLibraryView(state, { query, sort, activeTag });
  const filtering = query.trim() !== "" || activeTag !== null;

  const open = (id: string) => {
    selectLesson(id);
    closeScreen();
  };
  const makeNew = () => {
    createLesson();
    closeScreen();
  };
  const remove = (lesson: Lesson) => {
    const deleted = deleteLesson(lesson.id);
    if (deleted)
      toast.neutral(t("undo.deleted", { kind: lesson.title || t("topbar.untitled") }), {
        actionLabel: t("undo.action"),
        onAction: () => restoreLesson(deleted),
        timeout: 7000,
      });
  };
  // Tapping the active tag again clears the filter.
  const pickTag = (tag: string) => setActiveTag((cur) => (cur === tag ? null : tag));

  const card = (lesson: Lesson) => (
    <LessonCard
      key={lesson.id}
      lesson={lesson}
      now={now}
      onOpen={() => open(lesson.id)}
      onTogglePin={() => togglePin(lesson.id)}
      onSetTags={(tags) => setLessonTags(lesson.id, tags)}
      onExport={() => downloadLesson(lesson)}
      onDelete={() => remove(lesson)}
      onPickTag={pickTag}
    />
  );

  return (
    <ToolScreen
      title={t("library.title")}
      icon={Books}
      accent="--s-ink-muted"
      wide
      onClose={closeScreen}
    >
      <div className={s.controls}>
        <TextField className={`${f.field} ${s.searchField}`} aria-label={t("library.search")} value={query} onChange={setQuery}>
          <span className={s.searchIcon} aria-hidden>
            <MagnifyingGlass size={18} />
          </span>
          <Input className={`${f.textInput} ${s.searchInput}`} placeholder={t("library.searchPlaceholder")} />
        </TextField>

        <MenuTrigger>
          <Button className={s.sortBtn} aria-label={t("library.sort")}>
            <SortAscending size={18} aria-hidden /> {t(`library.sort${cap(sort)}`)}
          </Button>
          <Popover className={f.menuPopover}>
            <Menu
              className={f.menu}
              selectionMode="single"
              selectedKeys={[sort]}
              onAction={(k) => setSort(String(k) as LibrarySort)}
            >
              {SORTS.map((o) => (
                <MenuItem key={o} id={o} className={f.menuItem}>
                  {t(`library.sort${cap(o)}`)}
                </MenuItem>
              ))}
            </Menu>
          </Popover>
        </MenuTrigger>

        <Button className={s.newBtn} onPress={makeNew}>
          <Plus size={18} weight="bold" aria-hidden /> {t("topbar.newLesson")}
        </Button>
      </div>

      {view.allTags.length > 0 && (
        <div className={s.tagFilter} role="group" aria-label={t("library.filterByTag")}>
          <button
            type="button"
            className={s.filterChip}
            data-active={activeTag === null ? "" : undefined}
            onClick={() => setActiveTag(null)}
          >
            {t("library.allTags")}
          </button>
          {view.allTags.map(({ tag, count }) => (
            <button
              key={tag}
              type="button"
              className={s.filterChip}
              data-active={activeTag === tag ? "" : undefined}
              onClick={() => pickTag(tag)}
            >
              {tag} <span className={s.filterCount}>{count}</span>
            </button>
          ))}
        </div>
      )}

      {view.total === 0 ? (
        <EmptyState
          kind="general"
          neutral
          title={filtering ? t("library.noMatch") : t("library.empty")}
          hint={filtering ? t("library.noMatchHint") : t("library.emptyHint")}
        >
          {filtering ? (
            <button
              type="button"
              className={s.clearBtn}
              onClick={() => {
                setQuery("");
                setActiveTag(null);
              }}
            >
              {t("library.clearFilter")}
            </button>
          ) : (
            <Button className={s.newBtn} onPress={makeNew}>
              <Plus size={18} weight="bold" aria-hidden /> {t("topbar.newLesson")}
            </Button>
          )}
        </EmptyState>
      ) : (
        <>
          {view.pinned.length > 0 && (
            <section className={s.section}>
              <h2 className={s.sectionHead}>{t("library.pinnedHeading")}</h2>
              <div className={s.grid}>{view.pinned.map(card)}</div>
            </section>
          )}
          {view.rest.length > 0 && (
            <section className={s.section}>
              {view.pinned.length > 0 && <h2 className={s.sectionHead}>{t("library.allHeading")}</h2>}
              <div className={s.grid}>{view.rest.map(card)}</div>
            </section>
          )}
        </>
      )}
    </ToolScreen>
  );
}

const cap = (x: string) => x.charAt(0).toUpperCase() + x.slice(1);
