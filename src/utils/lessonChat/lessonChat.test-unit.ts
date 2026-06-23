import { describe, it, expect } from "vitest";
import { buildKnowledgeBase, buildChatMessages, type ChatTurn } from "./lessonChat.ts";
import type { AppState } from "../cellKinds/cellKinds.ts";

function stateWith(...lessons: AppState["lessons"][string][]): AppState {
  const map: AppState["lessons"] = {};
  const order: string[] = [];
  for (const l of lessons) {
    map[l.id] = l;
    order.push(l.id);
  }
  return { lessons: map, order, activeId: order[0] ?? null };
}

describe("buildKnowledgeBase", () => {
  it("digests each lesson's title and cell text in library order", () => {
    const state = stateWith(
      {
        id: "a",
        title: "Scales",
        created: 0,
        updated: 0,
        cells: [{ id: "c1", kind: "note", source: "play C major" }],
      },
      {
        id: "b",
        title: "Chords",
        created: 0,
        updated: 0,
        cells: [{ id: "c2", kind: "cifra", source: "G D Em C", transpose: 0 }],
      },
    );
    const kb = buildKnowledgeBase(state);
    expect(kb).toContain("## Scales");
    expect(kb).toContain("play C major");
    expect(kb.indexOf("Scales")).toBeLessThan(kb.indexOf("Chords")); // library order preserved
  });

  it("skips empty lessons and returns '' when nothing has text", () => {
    const state = stateWith({ id: "a", title: "", created: 0, updated: 0, cells: [] });
    expect(buildKnowledgeBase(state)).toBe("");
  });

  it("truncates with a marker once the character budget is exceeded", () => {
    const state = stateWith(
      {
        id: "a",
        title: "First",
        created: 0,
        updated: 0,
        cells: [{ id: "c1", kind: "note", source: "x".repeat(100) }],
      },
      {
        id: "b",
        title: "Second",
        created: 0,
        updated: 0,
        cells: [{ id: "c2", kind: "note", source: "y".repeat(100) }],
      },
    );
    const kb = buildKnowledgeBase(state, 120);
    expect(kb).toContain("First");
    expect(kb).not.toContain("Second");
    expect(kb).toContain("omitted");
  });
});

describe("buildChatMessages", () => {
  const history: ChatTurn[] = [{ role: "user", content: "what is a triad?" }];

  it("puts a system message first, then the history", () => {
    const msgs = buildChatMessages(history, "", "");
    expect(msgs[0].role).toBe("system");
    expect(msgs[msgs.length - 1].content).toBe("what is a triad?");
  });

  it("grounds in the retrieved reference when provided", () => {
    const msgs = buildChatMessages(history, "", "A triad has three notes.");
    expect(msgs[0].content).toContain("A triad has three notes.");
  });

  it("includes the learner's notebook digest when present", () => {
    const msgs = buildChatMessages(history, "MY NOTEBOOK DIGEST", "ref");
    expect(msgs[0].content).toContain("MY NOTEBOOK DIGEST");
  });
});
