# The Library is organized by tags + pinning, not folders

Once a learner accumulates more than ~20 Lessons, the flat Notebook dropdown stops scaling — there
is no way to find, group, or browse. We add a full-screen **Library** surface to fix this, and the
organizing primitive is **tags + a pinned flag**, deliberately **not folders**.

## Decision

A Lesson carries two optional, additive fields: `pinned?: boolean` and `tags?: string[]`. The
Library screen (hash route `#library`, reusing the `ToolScreen` chrome) browses Lessons as cards,
with search, sort, a pinned section, and a tag filter row.

Tags were chosen over folders because:

- **A Lesson belongs to many themes at once.** A "Bach Invention" is _repertoire_ **and**
  _sight-reading_ **and** _two-part counterpoint_. Folders force one home; tags don't.
- **No empty scaffolding.** Folders invite up-front structure ("make a Technique folder") before
  there's anything to put in it. Tags accrete from real use — you tag what you have.
- **Less model and less UI.** Folders need a folders collection, a `folderId` per Lesson, an
  "unfiled" bucket, and move-between-folders interactions. Tags are a string array plus a filter.

This also fits the product's self-directed identity (CONTEXT.md): the learner imposes their own
loose vocabulary rather than filing into a fixed hierarchy.

## Shape of it

- **Pinned ≠ recent.** Pinning floats a Lesson to the top regardless of sort. Toggling `pinned` or
  editing `tags` is organizing, not editing, so it **does not bump `updated`** — tidying the
  Library must never disturb a "sort by recent" view.
- **Tags are normalized** (lowercase, trimmed, de-duped, sorted) in one place
  (`lessonTags.normalizeTags`), applied by the store mutations, by `normalizeState` on load, and on
  import — so a tag set can't drift in casing or order across those paths.
- **Filtering is single-tag** for now (tap one chip to narrow); a Lesson can still hold **many**
  tags. Multi-tag AND filtering is a later refinement, intentionally deferred.
- **Forward/backward compatible.** Both fields are optional leaves on `Lesson`, so old IndexedDB
  records and old `.pnotes` files load unchanged, and the export envelope `EXPORT_VERSION` stays
  **3** — only optional fields were added, no shape change.
- The Notebook dropdown slims to the 3 most-recent Lessons + "Open Library…"; the screen is the
  full browse/organize surface.

## Consequences

- All sort/search/filter/grouping lives in a pure `selectLibraryView(state, opts)` selector, unit
  tested independently of the screen — the screen is a renderer over it.
- If folders are ever genuinely wanted, they layer on top (a folder is just a reserved special tag,
  or a new field) without unwinding this. We are not painting into a corner; we are declining
  premature hierarchy.
