import { marked } from "marked";

marked.setOptions({ gfm: true, breaks: true });

// --- Custom inline/block syntax marked doesn't ship with ----------------------
// Highlight (==x==), superscript (^x^), subscript (~x~, single tilde so it never
// clashes with ~~strikethrough~~), and footnotes ([^id] refs + [^id]: defs).
let footnotes = [];

const inlineWrap = (name, open, tag, re) => ({
  name,
  level: "inline",
  start(src) {
    const i = src.indexOf(open);
    return i < 0 ? undefined : i;
  },
  tokenizer(src) {
    const m = re.exec(src);
    if (!m) return undefined;
    const token = { type: name, raw: m[0], text: m[1], tokens: [] };
    this.lexer.inline(m[1], token.tokens);
    return token;
  },
  renderer(token) {
    return `<${tag}>${this.parser.parseInline(token.tokens)}</${tag}>`;
  },
});

marked.use({
  hooks: {
    preprocess(md) {
      footnotes = [];
      return md;
    },
    postprocess(html) {
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
      level: "block",
      start(src) {
        return src.match(/^\[\^[^\]]+\]:/m)?.index;
      },
      tokenizer(src) {
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
      level: "inline",
      start(src) {
        return src.indexOf("[^");
      },
      tokenizer(src) {
        const m = /^\[\^([^\]]+)\]/.exec(src);
        if (!m) return undefined;
        return { type: "footnoteRef", raw: m[0], id: m[1] };
      },
      renderer(token) {
        return (
          `<sup class="footnote-ref" id="fnref-${token.id}">` +
          `<a href="#fn-${token.id}">${token.id}</a></sup>`
        );
      },
    },
  ],
});

// Render markdown to sanitized HTML (strips scripts, inline handlers, js: urls).
export function renderMarkdown(src) {
  const html = marked.parse(src || "");
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
export function toggleTask(source, taskIndex, checked) {
  let i = -1;
  return source.replace(/\[( |x|X)\]/g, (m) => {
    i++;
    if (i === taskIndex) return checked ? "[x]" : "[ ]";
    return m;
  });
}

// Wrap / insert markdown formatting around a textarea selection.
// Returns { value, selStart, selEnd } for the caller to apply. Every action is
// selection-aware: it reuses selected text when present, otherwise drops a
// placeholder and selects it so the next keystroke replaces it.
export function applyFormat(value, selStart, selEnd, kind) {
  const sel = value.slice(selStart, selEnd);
  const before = value.slice(0, selStart);
  const after = value.slice(selEnd);

  // Inline wrap: `l…r` around the selection. Toggles — if the selection (or the
  // text just outside it) is already wrapped, the markers are stripped instead.
  const wrap = (l, r = l, placeholder = "text") => {
    // Markers inside the selection: `**text**` selected -> unwrap.
    if (sel.length >= l.length + r.length && sel.startsWith(l) && sel.endsWith(r)) {
      const inner = sel.slice(l.length, sel.length - r.length);
      return {
        value: before + inner + after,
        selStart: before.length,
        selEnd: before.length + inner.length,
      };
    }
    // Markers flanking the selection: **`text`** -> unwrap.
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

  // Block prefix applied to each selected line (or to a placeholder line).
  // Toggles: if every line already has the prefix it's removed; otherwise the
  // prefix is added (after stripping a conflicting same-family prefix, e.g.
  // switching heading levels or list styles). Selection lands on the content.
  const linePrefix = (prefix, placeholder = "", strip = null) => {
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

  // Wrap the selection, then place the caret-selection on a trailing token
  // (e.g. the URL of a link) for the user to fill in.
  const wrapWithTail = (lead, tail, tailPlaceholder, content) => {
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
      // Next number = highest existing definition + 1.
      const nums = [...value.matchAll(/\[\^(\d+)\]:/g)].map((m) => +m[1]);
      const n = (nums.length ? Math.max(...nums) : 0) + 1;
      const noteText = "Footnote text";
      // Selected text stays put as the anchor; the ref drops in right after it.
      const withRef = before + sel + `[^${n}]` + after;
      const gap = withRef.endsWith("\n\n") ? "" : withRef.endsWith("\n") ? "\n" : "\n\n";
      const full = withRef + gap + `[^${n}]: ${noteText}\n`;
      // Select the definition placeholder so it's ready to edit.
      const defStart = full.length - 1 - noteText.length;
      return { value: full, selStart: defStart, selEnd: defStart + noteText.length };
    }
    default:
      return { value, selStart, selEnd };
  }
}

// Replace the whole textarea value as one undoable step, then restore a selection.
export function replaceTextarea(ta, value, selStart, selEnd, onValue) {
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
