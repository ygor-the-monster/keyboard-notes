import { describe, it, expect } from "vitest";
import { applyFormat, toggleTask, renderMarkdown } from "./NoteCell.utils.ts";

describe("applyFormat", () => {
  it("wraps a selection in bold, and unwraps when toggled again", () => {
    expect(applyFormat("hello", 0, 5, "bold").value).toBe("**hello**");
    expect(applyFormat("**hello**", 2, 7, "bold").value).toBe("hello");
  });
  it("drops a placeholder when nothing is selected", () => {
    expect(applyFormat("", 0, 0, "italic").value).toBe("_italic text_");
  });
  it("toggles a heading prefix on the selected line", () => {
    expect(applyFormat("Title", 0, 5, "h1").value).toBe("# Title");
    expect(applyFormat("# Title", 0, 7, "h1").value).toBe("Title");
  });
  it("inserts a numbered footnote ref + definition", () => {
    const r = applyFormat("see", 3, 3, "footnote");
    expect(r.value).toContain("[^1]");
    expect(r.value).toContain("[^1]: Footnote text");
  });

  it("covers the inline + block + insert formats", () => {
    expect(applyFormat("x", 0, 1, "strike").value).toBe("~~x~~");
    expect(applyFormat("x", 0, 1, "code").value).toBe("`x`");
    expect(applyFormat("x", 0, 1, "highlight").value).toBe("==x==");
    expect(applyFormat("x", 0, 1, "superscript").value).toBe("^x^");
    expect(applyFormat("x", 0, 1, "subscript").value).toBe("~x~");
    expect(applyFormat("link", 0, 4, "link").value).toBe("[link](https://)");
    expect(applyFormat("a", 0, 1, "ul").value).toBe("- a");
    expect(applyFormat("a", 0, 1, "ol").value).toBe("1. a");
    expect(applyFormat("a", 0, 1, "task").value).toBe("- [ ] a");
    expect(applyFormat("a", 0, 1, "quote").value).toBe("> a");
    expect(applyFormat("c", 0, 1, "codeblock").value).toBe("```\nc\n```");
    expect(applyFormat("", 0, 0, "table").value).toContain("| Column | Column |");
    expect(applyFormat("a\n", 2, 2, "hr").value).toContain("---");
    expect(applyFormat("x", 0, 1, "unknown").value).toBe("x"); // default: unchanged
  });
});

describe("toggleTask", () => {
  it("flips the nth checkbox only", () => {
    expect(toggleTask("- [ ] a\n- [ ] b", 1, true)).toBe("- [ ] a\n- [x] b");
    expect(toggleTask("- [x] a", 0, false)).toBe("- [ ] a");
  });
});

describe("renderMarkdown", () => {
  it("renders markdown and strips scripts", () => {
    expect(renderMarkdown("**hi**")).toContain("<strong>hi</strong>");
    expect(renderMarkdown("<script>alert(1)</script>x")).not.toContain("<script>");
  });
  it("supports the custom ==highlight== syntax", () => {
    expect(renderMarkdown("==hi==")).toContain("<mark>hi</mark>");
  });
  it("neutralizes injected event handlers and dangerous URLs", () => {
    expect(renderMarkdown('<img src=x onerror="alert(1)">')).not.toContain("onerror");
    expect(renderMarkdown("[x](javascript:alert(1))")).not.toContain("javascript:");
    expect(renderMarkdown("<svg><script>alert(1)</script></svg>")).not.toContain("<script");
  });
  it("keeps GFM task checkboxes after sanitizing", () => {
    const html = renderMarkdown("- [x] done\n- [ ] todo");
    expect(html).toContain('type="checkbox"');
    expect(html).toContain("task"); // the <ul class="task"> hook survives
  });
  it("renders a [[code:time|label]] timestamp anchor as a data-button, never a router hash href", () => {
    // Timestamp Anchors are a custom token, NOT a Markdown link — so they emit a <button> carrying
    // the target code + time (seconds) in data-* attributes, with no `#…` href the router could
    // mistake for a screen.
    const html = renderMarkdown("[[A3F:1:23|go to chorus]]");
    expect(html).toContain('class="seek-anchor"');
    expect(html).toContain('data-seek-code="A3F"');
    expect(html).toContain('data-seek-time="83"'); // 1:23 parsed to seconds
    expect(html).toContain(">go to chorus</button>");
    expect(html).not.toContain("href"); // the whole point: no anchor/hash
  });
  it("uses the timecode as the anchor's label when none is given", () => {
    const html = renderMarkdown("[[V7Q:0:45]]");
    expect(html).toContain('data-seek-code="V7Q"');
    expect(html).toContain(">0:45</button>");
  });
});
