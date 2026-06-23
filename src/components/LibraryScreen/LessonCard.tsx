import { useState } from "react";
import {
  Button,
  DialogTrigger,
  Dialog,
  Popover,
  MenuTrigger,
  Menu,
  MenuItem,
  TextField,
  Input,
} from "react-aria-components";
import {
  PushPinIcon as PushPin,
  PushPinSlashIcon as PushPinSlash,
  DotsThreeVerticalIcon as DotsThreeVertical,
  TagIcon as Tag,
  XIcon as X,
  DownloadSimpleIcon as DownloadSimple,
  TrashIcon as Trash,
} from "@phosphor-icons/react";
import { useI18n } from "../../providers/I18nProvider/I18nProvider.tsx";
import { cellRegistry } from "../../utils/cellRegistry/cellRegistry.tsx";
import { formatRelativeTime } from "../../utils/relativeTime/relativeTime.ts";
import {
  LESSON_STATUSES,
  effectiveStatus,
  type LessonStatus,
} from "../../utils/lessonStatus/lessonStatus.ts";
import type { Lesson, Kind } from "../../utils/cellKinds/cellKinds.ts";
import f from "../fields/fields.module.css";
import s from "./LibraryScreen.module.css";

// One Lesson in the Library grid. The title block is the open affordance (a button); pin, tag
// editing, and the overflow menu (export / delete) sit alongside it so there are no nested buttons.
export default function LessonCard({
  lesson,
  now,
  onOpen,
  onTogglePin,
  onSetTags,
  onSetStatus,
  onExport,
  onDelete,
  onPickTag,
}: {
  lesson: Lesson;
  now: number;
  onOpen: () => void;
  onTogglePin: () => void;
  onSetTags: (tags: string[]) => void;
  onSetStatus: (status: LessonStatus) => void;
  onExport: () => void;
  onDelete: () => void;
  onPickTag: (tag: string) => void;
}) {
  const { t, locale } = useI18n();
  const tags = lesson.tags ?? [];
  const status = effectiveStatus(lesson);

  // The set of distinct cell kinds present, in first-appearance order — a compact visual fingerprint
  // of what the lesson holds, drawn in each kind's hue.
  const kinds: Kind[] = [];
  for (const c of lesson.cells) if (!kinds.includes(c.kind)) kinds.push(c.kind);

  return (
    <article className={`${s.card}${lesson.pinned ? ` ${s.cardPinned}` : ""}`}>
      <button type="button" className={s.cardOpen} onClick={onOpen}>
        <span className={s.cardTitle}>{lesson.title || t("topbar.untitled")}</span>
        {kinds.length > 0 && (
          <span className={s.cardKinds} aria-hidden>
            {kinds.map((k) => {
              const KindIcon = cellRegistry[k].icon;
              return (
                <span key={k} style={{ color: `var(${cellRegistry[k].hue.base})` }}>
                  <KindIcon size={14} weight="fill" />
                </span>
              );
            })}
          </span>
        )}
        <span className={s.cardMeta}>
          {t(lesson.cells.length === 1 ? "library.cellOne" : "library.cellOther", {
            count: lesson.cells.length,
          })}{" "}
          ·{" "}
          {t("library.updatedAgo", { time: formatRelativeTime(lesson.updated, now, locale) })}
        </span>
      </button>

      <div className={s.cardFoot}>
        <MenuTrigger>
          <Button
            className={s.statusBadge}
            data-status={status}
            aria-label={t("library.setStatus", { status: t(`library.status_${status}`) })}
          >
            <span className={s.statusDot} aria-hidden />
            {t(`library.status_${status}`)}
          </Button>
          <Popover className={f.menuPopover}>
            <Menu
              className={f.menu}
              selectionMode="single"
              selectedKeys={[status]}
              onAction={(k) => onSetStatus(String(k) as LessonStatus)}
            >
              {LESSON_STATUSES.map((st) => (
                <MenuItem key={st} id={st} className={f.menuItem}>
                  {t(`library.status_${st}`)}
                </MenuItem>
              ))}
            </Menu>
          </Popover>
        </MenuTrigger>

        {tags.length > 0 && (
          <div className={s.cardTags}>
            {tags.map((tag) => (
              <button key={tag} type="button" className={s.tagChip} onClick={() => onPickTag(tag)}>
                {tag}
              </button>
            ))}
          </div>
        )}
        <div className={s.cardControls}>
          <Button
            className={s.iconAction}
            aria-label={lesson.pinned ? t("library.unpin") : t("library.pin")}
            onPress={onTogglePin}
            data-active={lesson.pinned ? "" : undefined}
          >
            {lesson.pinned ? <PushPinSlash size={18} /> : <PushPin size={18} />}
          </Button>

          <DialogTrigger>
            <Button className={s.iconAction} aria-label={t("library.editTags")}>
              <Tag size={18} />
            </Button>
            <Popover className={f.menuPopover}>
              <Dialog className={s.tagDialog} aria-label={t("library.editTags")}>
                <TagEditor tags={tags} onSetTags={onSetTags} />
              </Dialog>
            </Popover>
          </DialogTrigger>

          <MenuTrigger>
            <Button className={s.iconAction} aria-label={t("library.cardActions")}>
              <DotsThreeVertical size={18} weight="bold" />
            </Button>
            <Popover className={f.menuPopover}>
              <Menu
                className={f.menu}
                onAction={(k) => {
                  if (k === "export") onExport();
                  else if (k === "delete") onDelete();
                }}
              >
                <MenuItem id="export" className={f.menuItem}>
                  <DownloadSimple size={16} aria-hidden /> {t("topbar.exportLesson")}
                </MenuItem>
                <MenuItem id="delete" className={f.menuItem}>
                  <Trash size={16} aria-hidden /> {t("topbar.deleteLesson")}
                </MenuItem>
              </Menu>
            </Popover>
          </MenuTrigger>
        </div>
      </div>
    </article>
  );
}

// Add-on-Enter tag input plus the current tags as removable chips. Each change commits immediately
// (normalization happens in the store), so there's no save button to forget.
function TagEditor({ tags, onSetTags }: { tags: string[]; onSetTags: (tags: string[]) => void }) {
  const { t } = useI18n();
  const [draft, setDraft] = useState("");

  const add = () => {
    const next = draft.trim();
    if (next) onSetTags([...tags, next]);
    setDraft("");
  };

  return (
    <div className={s.tagEditor}>
      {tags.length > 0 && (
        <div className={s.cardTags}>
          {tags.map((tag) => (
            <span key={tag} className={s.tagChip}>
              {tag}
              <button
                type="button"
                className={s.tagRemove}
                aria-label={t("library.removeTag", { tag })}
                onClick={() => onSetTags(tags.filter((x) => x !== tag))}
              >
                <X size={12} weight="bold" />
              </button>
            </span>
          ))}
        </div>
      )}
      <TextField
        className={f.field}
        aria-label={t("library.tags")}
        value={draft}
        onChange={setDraft}
      >
        <Input
          className={f.textInput}
          placeholder={t("library.addTagPlaceholder")}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          onBlur={add}
        />
      </TextField>
    </div>
  );
}
