import { marked } from "marked";
import DOMPurify from "dompurify";
import type { MarkedExtension, RendererThis, Tokens, TokenizerThis } from "marked";
import markedFootnote from "marked-footnote";
import { markedSmartypants } from "marked-smartypants";
import { SEEK_TOKEN_RE, parseTimecode, fmtTimecode } from "../../utils/seekBus/seekBus.ts";

marked.setOptions({ gfm: true, breaks: true });

// --- Custom inline syntax marked doesn't ship with ----------------------------
// Highlight (==x==), superscript (^x^), and subscript (~x~, single tilde so it never clashes
// with ~~strikethrough~~). Typed via marked's own extension types (TokenizerThis /
// RendererThis / Tokens.Generic).
const inlineWrap = (name: string, open: string, tag: string, re: RegExp) => ({
  name,
  level: "inline" as const,
  start(src: string) {
    const i = src.indexOf(open);
    return i < 0 ? undefined : i;
  },
  tokenizer(this: TokenizerThis, src: string) {
    const m = re.exec(src);
    if (!m) return undefined;
    const token = { type: name, raw: m[0], text: m[1], tokens: [] };
    this.lexer.inline(m[1], token.tokens);
    return token;
  },
  renderer(this: RendererThis, token: Tokens.Generic) {
    return `<${tag}>${this.parser.parseInline(token.tokens ?? [])}</${tag}>`;
  },
});

// Timestamp Anchor: `[[<code>:<time>|<label?>]]` → a <button> carrying the target Cell code + the
// time (in seconds) in data-* attributes; NoteCell resolves the code to a Cell and wires the click
// to the seek bus. A custom token, not a link, so it never emits a `#…` href the router would treat
// as a screen. The code is constrained by the regex; the label is HTML-escaped into text content.
const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const seekAnchor = {
  name: "seekAnchor",
  level: "inline" as const,
  start(src: string) {
    const i = src.indexOf("[[");
    return i < 0 ? undefined : i;
  },
  tokenizer(this: TokenizerThis, src: string) {
    const m = SEEK_TOKEN_RE.exec(src);
    if (!m) return undefined;
    const seconds = parseTimecode(m[2]);
    if (seconds == null) return undefined; // not a valid time → leave as literal text
    return { type: "seekAnchor", raw: m[0], code: m[1], seconds, label: m[3] ?? "" };
  },
  renderer(this: RendererThis, token: Tokens.Generic) {
    const seconds = token.seconds as number;
    const label = (token.label as string).trim() || fmtTimecode(seconds);
    return `<button type="button" class="seek-anchor" data-seek-code="${token.code}" data-seek-time="${seconds}">${escapeHtml(label)}</button>`;
  },
};

marked.use({
  extensions: [
    inlineWrap("highlight", "==", "mark", /^==(?=\S)([\s\S]*?\S)==/),
    inlineWrap("superscript", "^", "sup", /^\^([^\s^]+)\^/),
    inlineWrap("subscript", "~", "sub", /^~(?!~)([^\s~]+)~(?!~)/),
    seekAnchor,
  ],
} satisfies MarkedExtension);

// GFM footnotes ([^id] refs + [^id]: defs) rendered with accessible markup — each ref carries
// aria-describedby, each definition gets a back-reference link, and the section is introduced by
// an sr-only "Footnotes" heading (styled in ThemeProvider.globals.css). Multi-paragraph footnote
// bodies are supported. Plus marked-smartypants for smart typographic punctuation (curly quotes,
// en/em dashes, ellipses) in prose.
marked.use(markedFootnote());
marked.use(markedSmartypants());

// Render markdown to sanitized HTML (strips scripts, inline handlers, js: urls). Pass `idScope`
// (e.g. the cell id) to namespace footnote ids/links so several rendered Notes can coexist on the
// page without colliding ids — `footnote-1` becomes `footnote-1-<idScope>` on both the definition
// and the refs/back-links that point at it.
export function renderMarkdown(src: string, idScope?: string): string {
  const dirty = marked.parse(src || "") as string;
  // Sanitize with DOMPurify (a vetted allow-list sanitizer) rather than a hand-rolled deny-list.
  // The HTML profile keeps the markup we emit — including GFM task <input> checkboxes and footnote
  // anchors — while dropping scripts, event handlers, javascript:/data: URLs, and SVG/MathML vectors.
  const clean = DOMPurify.sanitize(dirty, { USE_PROFILES: { html: true } });
  const tpl = document.createElement("template");
  tpl.innerHTML = clean;
  const scope = idScope ? `-${idScope}` : "";
  // Footnote id scoping is app logic (namespacing refs ↔ defs per cell), not sanitization.
  if (scope) {
    tpl.content.querySelectorAll("*").forEach((node) => {
      [...node.attributes].forEach((attr) => {
        const name = attr.name.toLowerCase();
        if (name === "id" && attr.value.startsWith("footnote"))
          node.setAttribute("id", attr.value + scope);
        else if (name === "aria-describedby" && attr.value.startsWith("footnote"))
          node.setAttribute("aria-describedby", attr.value + scope);
        else if (name === "href" && attr.value.startsWith("#footnote"))
          node.setAttribute("href", attr.value + scope);
      });
    });
  }
  tpl.content.querySelectorAll("li > input[type=checkbox]").forEach((cb) => {
    cb.closest("ul")?.classList.add("task");
  });
  return tpl.innerHTML;
}

// Flip the Nth `- [ ]` / `- [x]` task in the source. Returns new source.
export function toggleTask(source: string, taskIndex: number, checked: boolean): string {
  let i = -1;
  return source.replace(/\[( |x|X)\]/g, (m) => {
    i++;
    if (i === taskIndex) return checked ? "[x]" : "[ ]";
    return m;
  });
}

export interface FormatResult {
  value: string;
  selStart: number;
  selEnd: number;
}

// Wrap / insert markdown formatting around a textarea selection. Returns the new value + selection
// for the caller to apply. Every action is selection-aware: it reuses selected text when present,
// otherwise drops a placeholder and selects it so the next keystroke replaces it.
export function applyFormat(
  value: string,
  selStart: number,
  selEnd: number,
  kind: string,
): FormatResult {
  const sel = value.slice(selStart, selEnd);
  const before = value.slice(0, selStart);
  const after = value.slice(selEnd);

  // Inline wrap: `l…r` around the selection. Toggles — if the selection (or the text just outside
  // it) is already wrapped, the markers are stripped instead.
  const wrap = (l: string, r: string = l, placeholder = "text"): FormatResult => {
    if (sel.length >= l.length + r.length && sel.startsWith(l) && sel.endsWith(r)) {
      const inner = sel.slice(l.length, sel.length - r.length);
      return {
        value: before + inner + after,
        selStart: before.length,
        selEnd: before.length + inner.length,
      };
    }
    if (before.endsWith(l) && after.startsWith(r)) {
      const nb = before.slice(0, before.length - l.length);
      const na = after.slice(r.length);
      return { value: nb + sel + na, selStart: nb.length, selEnd: nb.length + sel.length };
    }
    const inner = sel || placeholder;
    return {
      value: before + l + inner + r + after,
      selStart: before.length + l.length,
      selEnd: before.length + l.length + inner.length,
    };
  };

  // Block prefix applied to each selected line (or to a placeholder line). Toggles: if every line
  // already has the prefix it's removed; otherwise the prefix is added (after stripping a
  // conflicting same-family prefix). Selection lands on the content.
  const linePrefix = (
    prefix: string,
    placeholder = "",
    strip: RegExp | null = null,
  ): FormatResult => {
    const startOfLine = before.lastIndexOf("\n") + 1;
    const head = value.slice(0, startOfLine);
    const raw = value.slice(startOfLine, selEnd);
    const block = raw || placeholder;
    const lines = block.split("\n");
    const allHave = lines.every((ln) => ln.startsWith(prefix));
    const replaced = lines
      .map((ln) =>
        allHave ? ln.slice(prefix.length) : prefix + (strip ? ln.replace(strip, "") : ln),
      )
      .join("\n");
    const tail = value.slice(selEnd);
    return {
      value: head + replaced + tail,
      selStart: allHave ? startOfLine : startOfLine + prefix.length,
      selEnd: startOfLine + replaced.length,
    };
  };

  const HEADING = /^#{1,6}\s+/;
  const LISTMARK = /^(\d+\.\s+|[-*+]\s+(\[[ xX]\]\s+)?)/;

  // Wrap the selection, then place the caret-selection on a trailing token (e.g. a link URL).
  const wrapWithTail = (
    lead: string,
    tail: string,
    tailPlaceholder: string,
    content: string,
  ): FormatResult => {
    const inner = sel || content;
    const md = lead + inner + tail;
    const tailAt =
      before.length + lead.length + inner.length + (tail.length - tailPlaceholder.length);
    return {
      value: before + md + after,
      selStart: tailAt,
      selEnd: tailAt + tailPlaceholder.length,
    };
  };

  switch (kind) {
    case "bold":
      return wrap("**", "**", "bold text");
    case "italic":
      return wrap("_", "_", "italic text");
    case "strike":
      return wrap("~~", "~~", "struck text");
    case "code":
      return wrap("`", "`", "code");
    case "highlight":
      return wrap("==", "==", "highlighted");
    case "superscript":
      return wrap("^", "^", "sup");
    case "subscript":
      return wrap("~", "~", "sub");
    case "link":
      return wrapWithTail("[", "](https://)", "https://", "link text");

    case "h1":
      return linePrefix("# ", "Heading", HEADING);
    case "h2":
      return linePrefix("## ", "Heading", HEADING);
    case "h3":
      return linePrefix("### ", "Heading", HEADING);
    case "ul":
      return linePrefix("- ", "List item", LISTMARK);
    case "ol":
      return linePrefix("1. ", "List item", LISTMARK);
    case "task":
      return linePrefix("- [ ] ", "Practice task", LISTMARK);
    case "quote":
      return linePrefix("> ", "Quote");

    case "codeblock": {
      const inner = sel || "code";
      const md = "```\n" + inner + "\n```";
      return {
        value: before + md + after,
        selStart: before.length + 4,
        selEnd: before.length + 4 + inner.length,
      };
    }
    case "table": {
      const md = "| Column | Column |\n| --- | --- |\n| Cell | Cell |\n";
      return {
        value: before + md + after,
        selStart: before.length,
        selEnd: before.length + 8, // selects the first "Column" header
      };
    }
    case "hr": {
      const lead = before.endsWith("\n") || before === "" ? "" : "\n";
      const md = lead + "\n---\n\n";
      const at = before.length + md.length;
      return { value: before + md + after, selStart: at, selEnd: at };
    }
    case "footnote": {
      const nums = [...value.matchAll(/\[\^(\d+)\]:/g)].map((m) => +m[1]);
      const n = (nums.length ? Math.max(...nums) : 0) + 1;
      const noteText = "Footnote text";
      const withRef = before + sel + `[^${n}]` + after;
      const gap = withRef.endsWith("\n\n") ? "" : withRef.endsWith("\n") ? "\n" : "\n\n";
      const full = withRef + gap + `[^${n}]: ${noteText}\n`;
      const defStart = full.length - 1 - noteText.length;
      return { value: full, selStart: defStart, selEnd: defStart + noteText.length };
    }
    default:
      return { value, selStart, selEnd };
  }
}
