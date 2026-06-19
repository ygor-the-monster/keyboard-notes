import { describe, it, expect, afterEach } from "vitest";
import { insertIntoTextarea, replaceTextarea } from "./textEditing.ts";

// Real-browser tests: these primitives write through document.execCommand("insertText"), which only
// behaves in a live document — that's the whole point (native undo stack, ADR-0003).
let ta: HTMLTextAreaElement;
function makeTextarea(value: string, selStart: number, selEnd = selStart): HTMLTextAreaElement {
  ta = document.createElement("textarea");
  document.body.appendChild(ta);
  ta.value = value;
  ta.focus();
  ta.setSelectionRange(selStart, selEnd);
  return ta;
}
afterEach(() => ta?.remove());

describe("insertIntoTextarea", () => {
  it("inserts at the caret, replacing any selection", () => {
    insertIntoTextarea(makeTextarea("ab", 1), "X");
    expect(ta.value).toBe("aXb");
    expect(ta.selectionStart).toBe(2);
  });

  it("replaces the current selection", () => {
    insertIntoTextarea(makeTextarea("abcd", 1, 3), "X");
    expect(ta.value).toBe("aXd");
  });

  it("leaves the caret `back` chars from the end for paired tokens", () => {
    insertIntoTextarea(makeTextarea("", 0), "()", 1);
    expect(ta.value).toBe("()");
    expect(ta.selectionStart).toBe(1);
  });

  it("is undoable as one native step", () => {
    insertIntoTextarea(makeTextarea("ab", 1), "X");
    document.execCommand("undo");
    expect(ta.value).toBe("ab");
  });

  it("is a no-op on a null textarea", () => {
    expect(() => insertIntoTextarea(null, "X")).not.toThrow();
  });
});

describe("replaceTextarea", () => {
  it("replaces the whole value and restores the given selection", () => {
    replaceTextarea(makeTextarea("hello", 0), "world", 1, 3);
    expect(ta.value).toBe("world");
    expect([ta.selectionStart, ta.selectionEnd]).toEqual([1, 3]);
  });

  it("replaces as one undoable native step", () => {
    replaceTextarea(makeTextarea("hello", 0), "world", 0, 0);
    document.execCommand("undo");
    expect(ta.value).toBe("hello");
  });
});
