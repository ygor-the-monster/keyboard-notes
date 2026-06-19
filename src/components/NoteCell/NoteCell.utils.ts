import { marked } from "marked";
import type { MarkedExtension, RendererThis, Tokens, TokenizerThis } from "marked";

marked.setOptions({ gfm: true, breaks: true });

// --- Custom inline/block syntax marked doesn't ship with ----------------------
// Highlight (==x==), superscript (^x^), subscript (~x~, single tilde so it never clashes with
// ~~strikethrough~~), and footnotes ([^id] refs + [^id]: defs). Typed via marked's own extension
// types (TokenizerThis / RendererThis / Tokens.Generic).
interface Footnote {
  id: string;
  text: string;
}
let footnotes: Footnote[] = [];

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

marked.use({
  hooks: {
    preprocess(md: string) {
      footnotes = [];
      return md;
    },
    postprocess(html: string) {
      if (!footnotes.length) return html;
      const items = footnotes
        .map(
          (f) =>
            `<li id="fn-${f.id}">${marked.parseInline(f.text)} ` +
            `<a href="#fnref-${f.id}" class="footnote-back">↩</a></li>`,
        )
        .join("");
      return `${html}<hr class="footnotes-sep"><ol class="footnotes">${items}</ol>`;
    },
  },
  extensions: [
    inlineWrap("highlight", "==", "mark", /^==(?=\S)([\s\S]*?\S)==/),
    inlineWrap("superscript", "^", "sup", /^\^([^\s^]+)\^/),
    inlineWrap("subscript", "~", "sub", /^~(?!~)([^\s~]+)~(?!~)/),
    {
      name: "footnoteDef",
      level: "block" as const,
      start(src: string) {
        return src.match(/^\[\^[^\]]+\]:/m)?.index;
      },
      tokenizer(src: string) {
        const m = /^\[\^([^\]]+)\]:[ \t]*(.*)(?:\n|$)/.exec(src);
        if (!m) return undefined;
        footnotes.push({ id: m[1], text: m[2] });
        return { type: "footnoteDef", raw: m[0], id: m[1], text: m[2] };
      },
      renderer() {
        return ""; // definitions are rendered together at the bottom
      },
    },
    {
      name: "footnoteRef",
      level: "inline" as const,
      start(src: string) {
        return src.indexOf("[^");
      },
      tokenizer(src: string) {
        const m = /^\[\^([^\]]+)\]/.exec(src);
        if (!m) return undefined;
        return { type: "footnoteRef", raw: m[0], id: m[1] };
      },
      renderer(this: RendererThis, token: Tokens.Generic) {
        return (
          `<sup class="footnote-ref" id="fnref-${token.id}">` +
          `<a href="#fn-${token.id}">${token.id}</a></sup>`
        );
      },
    },
  ],
} satisfies MarkedExtension);

// Render markdown to sanitized HTML (strips scripts, inline handlers, js: urls).
export function renderMarkdown(src: string): string {
  const html = marked.parse(src || "") as string;
  const tpl = document.createElement("template");
  tpl.innerHTML = html;
  tpl.content.querySelectorAll("script, style, iframe, object, embed").forEach((n) => n.remove());
  tpl.content.querySelectorAll("*").forEach((node) => {
    [...node.attributes].forEach((attr) => {
      const name = attr.name.toLowerCase();
      const val = attr.value.toLowerCase().trim();
      if (name.startsWith("on")) node.removeAttribute(attr.name);
      if ((name === "href" || name === "src") && val.startsWith("javascript:"))
        node.removeAttribute(attr.name);
    });
  });
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
