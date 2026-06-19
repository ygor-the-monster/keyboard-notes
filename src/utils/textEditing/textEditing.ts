// The one home for textarea edits that must land on the browser's *native* undo stack. Toolbar
// actions in the Note and Score editors write through `execCommand("insertText", …)` so a single
// Cmd/Ctrl-Z reverts them alongside ordinary typing (ADR-0003). These two primitives are that
// mechanism — previously copied into each editor's utils, now in one place with one test surface.
// Each falls back to a direct DOM write (calling `onValue` so the caller can sync state) when
// execCommand is unavailable.

// Insert text at the caret (replacing any selection); `back` leaves the caret N chars from the end
// (for paired tokens like "()" or "[]").
export function insertIntoTextarea(
  ta: HTMLTextAreaElement | null,
  text: string,
  back = 0,
  onValue?: (v: string) => void,
): void {
  if (!ta) return;
  ta.focus();
  const inserted = document.execCommand && document.execCommand("insertText", false, text);
  if (!inserted) {
    ta.setRangeText(text, ta.selectionStart, ta.selectionEnd, "end");
    onValue?.(ta.value);
  }
  if (back) {
    const p = ta.selectionStart - back;
    ta.setSelectionRange(p, p);
  }
}

// Replace the whole textarea value as one undoable step, then restore a selection.
export function replaceTextarea(
  ta: HTMLTextAreaElement | null,
  value: string,
  selStart: number,
  selEnd: number,
  onValue?: (v: string) => void,
): void {
  if (!ta) return;
  ta.focus();
  ta.select();
  const ok = document.execCommand && document.execCommand("insertText", false, value);
  if (!ok) {
    ta.value = value;
    onValue?.(value);
  }
  ta.setSelectionRange(selStart, selEnd);
}
