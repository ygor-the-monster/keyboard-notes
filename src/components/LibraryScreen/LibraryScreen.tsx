import { useEffect, useState } from "react";
import {
  Button,
  MenuTrigger,
  Menu,
  MenuItem,
  MenuSection,
  Header,
  Separator,
  Popover,
  TextField,
  Input,
} from "react-aria-components";
import {
  BooksIcon as Books,
  MagnifyingGlassIcon as MagnifyingGlass,
  SortAscendingIcon as SortAscending,
  PlusIcon as Plus,
  ArrowCounterClockwiseIcon as ArrowCounterClockwise,
  TrashIcon as Trash,
} from "@phosphor-icons/react";
import { useRoute } from "../../providers/RouteProvider/RouteProvider.tsx";
import { useStore } from "../../providers/StoreProvider/StoreProvider.tsx";
import { useI18n } from "../../providers/I18nProvider/I18nProvider.tsx";
import { toast } from "../Toasts/toasts.ts";
import { selectLibraryView, type LibrarySort } from "../../utils/libraryView/libraryView.ts";
import { isTemplate } from "../../utils/lessonStatus/lessonStatus.ts";
import { serializeLesson, lessonFilename } from "../../utils/lessonExport/lessonExport.ts";
import {
  listDeleted,
  removeDeleted,
  type DeletedEntry,
} from "../../utils/recentlyDeleted/recentlyDeleted.ts";
import { formatRelativeTime } from "../../utils/relativeTime/relativeTime.ts";
import { cellRegistry } from "../../utils/cellRegistry/cellRegistry.tsx";
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
  const {
    state,
    selectLesson,
    createLesson,
    createLessonFromTemplate,
    togglePin,
    setLessonTags,
    setLessonStatus,
    deleteLesson,
    restoreLesson,
    restoreCell,
  } = useStore();
  const { t, locale } = useI18n();

  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<LibrarySort>("recent");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  // The Recently Deleted bin lives in sessionStorage, not the store — mirror it into state and
  // refresh whenever the Library screen opens (a deletion may have happened while it was closed).
  const [deleted, setDeleted] = useState<DeletedEntry[]>([]);
  useEffect(() => {
    if (screen === LIBRARY_SCREEN) setDeleted(listDeleted());
  }, [screen]);

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
  // Lessons flagged status="template" are offered as starting points (in Library order).
  const templates = state.order.map((id) => state.lessons[id]).filter(Boolean).filter(isTemplate);
  const makeFromTemplate = (id: string) => {
    createLessonFromTemplate(id);
    closeScreen();
  };
  const remove = (lesson: Lesson) => {
    const removed = deleteLesson(lesson.id);
    if (removed) {
      setDeleted(listDeleted()); // it just landed in the Recently Deleted bin below
      toast.neutral(t("undo.deleted", { kind: lesson.title || t("topbar.untitled") }), {
        actionLabel: t("undo.action"),
        onAction: () => {
          restoreLesson(removed);
          removeDeleted(removed.lesson.id);
          setDeleted(listDeleted());
        },
        timeout: 7000,
      });
    }
  };

  // Restore (or permanently drop) an entry parked in the Recently Deleted bin.
  const restoreEntry = (entry: DeletedEntry) => {
    if (entry.kind === "lesson") restoreLesson(entry.payload);
    else restoreCell(entry.payload);
    removeDeleted(entry.id);
    setDeleted(listDeleted());
  };
  const purgeEntry = (entry: DeletedEntry) => {
    removeDeleted(entry.id);
    setDeleted(listDeleted());
  };
  const entryLabel = (entry: DeletedEntry) =>
    entry.kind === "lesson"
      ? entry.title || t("topbar.untitled")
      : t("recentlyDeleted.cellLabel", {
          kind: t(cellRegistry[entry.cellKind as keyof typeof cellRegistry].tagLabelKey),
          lesson: entry.lessonTitle || t("topbar.untitled"),
        });
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
      onSetStatus={(status) => setLessonStatus(lesson.id, status)}
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

        {templates.length > 0 ? (
          <MenuTrigger>
            <Button className={s.newBtn} aria-label={t("topbar.newLesson")}>
              <Plus size={18} weight="bold" aria-hidden /> {t("topbar.newLesson")}
            </Button>
            <Popover className={f.menuPopover}>
              <Menu
                className={f.menu}
                onAction={(k) => (k === "blank" ? makeNew() : makeFromTemplate(String(k)))}
              >
                <MenuSection>
                  <MenuItem id="blank" className={f.menuItem}>
                    {t("library.newBlank")}
                  </MenuItem>
                </MenuSection>
                <Separator className={f.menuSeparator} />
                <MenuSection>
                  <Header className={f.menuSectionHeader}>{t("library.fromTemplate")}</Header>
                  {templates.map((tpl) => (
                    <MenuItem key={tpl.id} id={tpl.id} className={f.menuItem}>
                      {tpl.title || t("topbar.untitled")}
                    </MenuItem>
                  ))}
                </MenuSection>
              </Menu>
            </Popover>
          </MenuTrigger>
        ) : (
          <Button className={s.newBtn} onPress={makeNew}>
            <Plus size={18} weight="bold" aria-hidden /> {t("topbar.newLesson")}
          </Button>
        )}
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

      {deleted.length > 0 && (
        <section className={s.section}>
          <h2 className={s.sectionHead}>{t("recentlyDeleted.heading")}</h2>
          <p className={s.trashNote}>{t("recentlyDeleted.note")}</p>
          <ul className={s.trashList}>
            {deleted.map((entry) => (
              <li key={entry.id} className={s.trashItem}>
                <span className={s.trashLabel}>
                  {entryLabel(entry)}
                  <span className={s.trashTime}>{formatRelativeTime(entry.at, now, locale)}</span>
                </span>
                <div className={s.trashActions}>
                  <button
                    type="button"
                    className={s.trashBtn}
                    onClick={() => restoreEntry(entry)}
                    aria-label={t("recentlyDeleted.restore")}
                    title={t("recentlyDeleted.restore")}
                  >
                    <ArrowCounterClockwise size={16} aria-hidden /> {t("recentlyDeleted.restore")}
                  </button>
                  <button
                    type="button"
                    className={`${s.trashBtn} ${s.trashBtnDanger}`}
                    onClick={() => purgeEntry(entry)}
                    aria-label={t("recentlyDeleted.purge")}
                    title={t("recentlyDeleted.purge")}
                  >
                    <Trash size={16} aria-hidden />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </ToolScreen>
  );
}

const cap = (x: string) => x.charAt(0).toUpperCase() + x.slice(1);
