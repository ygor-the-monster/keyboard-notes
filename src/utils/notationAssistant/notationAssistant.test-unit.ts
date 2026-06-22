import { describe, it, expect } from "vitest";
import {
  parseAssistantReply,
  extractReplyText,
  buildMessages,
  parseContentReply,
  buildTextMessages,
} from "./notationAssistant.ts";

describe("parseAssistantReply", () => {
  it("parses a clean JSON object", () => {
    expect(parseAssistantReply('{"header":"X:1\\nK:C","body":"C D E F |"}')).toEqual({
      header: "X:1\nK:C",
      body: "C D E F |",
    });
  });

  it("drops an empty header (caller keeps the current one)", () => {
    expect(parseAssistantReply('{"header":"","body":"G A B c |"}')).toEqual({ body: "G A B c |" });
    expect(parseAssistantReply('{"body":"G A B c |"}')).toEqual({ body: "G A B c |" });
  });

  it("ignores surrounding prose and code fences", () => {
    const raw = 'Sure! Here you go:\n```json\n{"body":"C2 D2 | E2 F2 |"}\n```\nHope that helps.';
    expect(parseAssistantReply(raw)).toEqual({ body: "C2 D2 | E2 F2 |" });
  });

  it("handles braces inside string values", () => {
    expect(parseAssistantReply('{"body":"C {d} E |"}')).toEqual({ body: "C {d} E |" });
  });

  it("returns null when there is no JSON object", () => {
    expect(parseAssistantReply("I cannot do that.")).toBeNull();
  });

  it("returns null when the body is missing or blank", () => {
    expect(parseAssistantReply('{"header":"X:1"}')).toBeNull();
    expect(parseAssistantReply('{"body":"   "}')).toBeNull();
  });

  it("returns null on malformed JSON", () => {
    expect(parseAssistantReply('{"body": unquoted }')).toBeNull();
  });
});

describe("extractReplyText", () => {
  it("reads the assistant content from a chat-style generated_text array", () => {
    const out = [
      {
        generated_text: [
          { role: "user", content: "hi" },
          { role: "assistant", content: '{"body":"C D |"}' },
        ],
      },
    ];
    expect(extractReplyText(out)).toBe('{"body":"C D |"}');
  });

  it("reads a plain-string generated_text", () => {
    expect(extractReplyText([{ generated_text: '{"body":"C |"}' }])).toBe('{"body":"C |"}');
  });

  it("returns empty string for an unexpected shape", () => {
    expect(extractReplyText(null)).toBe("");
    expect(extractReplyText([{}])).toBe("");
  });
});

describe("buildMessages", () => {
  it("includes the instruction, header and body, and a system turn", () => {
    const msgs = buildMessages("split every third beat", "X:1\nK:C", "C D E F |");
    expect(msgs[0].role).toBe("system");
    expect(msgs[1].role).toBe("user");
    expect(msgs[1].content).toContain("split every third beat");
    expect(msgs[1].content).toContain("X:1\nK:C");
    expect(msgs[1].content).toContain("C D E F |");
  });

  it("appends the retry note only when given", () => {
    expect(buildMessages("x", "h", "b").join("")).not.toContain("corrected JSON");
    expect(
      buildMessages("x", "h", "b", "Return ONLY the corrected JSON object.")[1].content,
    ).toContain("corrected JSON");
  });
});

describe("parseContentReply (single-text kinds)", () => {
  it("reads a non-empty content field", () => {
    expect(parseContentReply('{"content":"# Title\\n\\n- a\\n- b"}')).toBe("# Title\n\n- a\n- b");
  });

  it("ignores prose and code fences around the JSON", () => {
    expect(parseContentReply('Done:\n```json\n{"content":"[Verse]\\nC  G"}\n```')).toBe(
      "[Verse]\nC  G",
    );
  });

  it("returns null when content is missing, blank, or malformed", () => {
    expect(parseContentReply('{"text":"oops"}')).toBeNull();
    expect(parseContentReply('{"content":"   "}')).toBeNull();
    expect(parseContentReply("no json here")).toBeNull();
  });
});

describe("buildTextMessages", () => {
  it("selects the system prompt by kind and embeds instruction + document", () => {
    const md = buildTextMessages("markdown", "make a list", "a\nb");
    expect(md[0].content).toContain("Markdown");
    expect(md[1].content).toContain("make a list");
    expect(md[1].content).toContain("a\nb");

    const chords = buildTextMessages("chords", "transpose up", "[Verse]\nC G");
    expect(chords[0].content).toContain("chord chart");
    expect(chords[1].content).toContain("transpose up");
  });
});
