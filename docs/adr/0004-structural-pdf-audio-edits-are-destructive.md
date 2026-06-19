# PDF page edits and audio trims are intentionally destructive

The non-destructive invariant (CONTEXT.md) scopes to the **view-time overlays only** — the Filter
on an Image, the Annotation on an Image or PDF, and the Marks on Audio. These layer on top of the
Original and are applied at render time; they never touch the Original bytes.

**Structural edits do overwrite the Original, by design.** PDF page rotate / move / duplicate /
remove (`PdfCell.tsx`) and Audio trim / delete / record-splice (`AudioCell.tsx`) rebuild
`cell.dataUrl` in place. A rotated page or a trimmed clip is a permanent edit the maker wants baked
in; the PDF and audio byte formats require structural rewriting; and modelling these as reversible
layers would mean carrying format-specific diff layers with no user-facing value.

Recorded because an architecture review will see `PdfCell`/`AudioCell` rewriting `cell.dataUrl` and
flag it as a violation of "the Original is never overwritten." It is not — the invariant was never
meant to cover structural edits. Do not propose folding these into a reversible overlay layer.

## Consequences

- The non-destructive guarantee is testable only for the overlays (Filter, Annotation, Mark): an
  edit through those must leave the Original unchanged. Structural edits have no such guarantee and
  must not be asserted to.
