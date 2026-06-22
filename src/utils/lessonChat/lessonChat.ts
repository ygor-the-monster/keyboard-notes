// The standalone "music tutor" chat agent (the docked panel below the lesson). Runs fully on-device
// via the same Transformers.js pipeline machinery as the editing assistant, and answers music
// questions grounded in two things stuffed into its system prompt: a static music-theory primer
// (MUSIC_KB) and a capped digest of everything the user has written across their lessons. The KB is
// what makes a small model viable here — it turns recall into grounded reading comprehension (see
// the model note below), so no embeddings/RAG and no separate larger download are required.
import {
  AssistantError,
  extractReplyText,
  loadGenerator,
  type LoadProgress,
} from "../notationAssistant/notationAssistant.ts";
import { resolveTier, type ModelTier } from "../aiModel/aiModel.ts";
import { retrieve, formatContext } from "../lessonKb/kbIndex.ts";
import MUSIC_KB from "../../prompts/music-kb.md?raw";
import PERSONA from "../../prompts/chat-persona.md?raw";
import type { AppState, Cell, Lesson } from "../cellKinds/cellKinds.ts";

// The chat shares the user's selected model tier with the editing assistant (see aiModel.ts); both
// resolve the model id + dtype from that one preference. RAG grounding (see kbIndex.ts) means even
// the smallest tier handles tutor-style grounded QA respectably.
const MAX_NEW_TOKENS = 512;
const KB_CHAR_BUDGET = 8000; // keep the notebook digest well under the model's context window.

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

// --- Knowledge base from the user's own content (pure / unit-tested) ----------------------

// One cell's human-readable text for the KB, or "" for cells that carry no text (media). Mirrors
// the cell kinds in cellKinds.ts.
function cellText(cell: Cell): string {
  switch (cell.kind) {
    case "note":
      return cell.source.trim();
    case "cifra":
      return cell.source.trim();
    case "score":
      return [cell.header, cell.body].filter(Boolean).join("\n").trim();
    case "external":
      return [cell.title, cell.url].filter(Boolean).join(" — ").trim();
    case "pdf":
      return cell.name?.trim() || "";
    default:
      return ""; // image / audio: no text content
  }
}

// A readable digest of one lesson: its title plus each cell's text, tagged by kind.
function lessonText(lesson: Lesson): string {
  const parts = lesson.cells
    .map((c) => {
      const text = cellText(c);
      return text ? `[${c.kind}] ${text}` : "";
    })
    .filter(Boolean);
  if (!parts.length) return "";
  return `## ${lesson.title?.trim() || "Untitled lesson"}\n${parts.join("\n\n")}`;
}

// Build the notebook knowledge base: every lesson's text, in library order, capped to a character
// budget so it can't blow the context window. Truncates with a marker rather than dropping silently.
export function buildKnowledgeBase(state: AppState, budget = KB_CHAR_BUDGET): string {
  const blocks: string[] = [];
  let used = 0;
  let truncated = false;
  for (const id of state.order) {
    const lesson = state.lessons[id];
    if (!lesson) continue;
    const block = lessonText(lesson);
    if (!block) continue;
    if (used + block.length > budget) {
      truncated = true;
      break;
    }
    blocks.push(block);
    used += block.length + 2;
  }
  if (!blocks.length) return "";
  return blocks.join("\n\n") + (truncated ? "\n\n[…more lessons omitted to fit context…]" : "");
}

// --- Prompt + run -------------------------------------------------------------------------

// `reference` is the theory grounding: the chunks retrieved for this question, or "" if retrieval
// was unavailable — in which case we fall back to the bundled static primer so the tutor is never
// left ungrounded.
export function buildChatMessages(
  history: ChatTurn[],
  kb: string,
  reference: string,
): { role: string; content: string }[] {
  const theory = reference.trim() || MUSIC_KB.trim();
  const system = [
    PERSONA.trim(),
    "",
    "MUSIC THEORY REFERENCE (ground your answers in this):",
    theory,
    kb ? `\nTHE LEARNER'S NOTEBOOK (their own lessons, for context):\n${kb}` : "",
  ].join("\n");
  return [{ role: "system", content: system }, ...history];
}

// The latest user turn drives retrieval. Pulled out so it's obvious what we embed.
function latestQuestion(history: ChatTurn[]): string {
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].role === "user") return history[i].content;
  }
  return "";
}

// Send the conversation to the on-device model and resolve the assistant's reply text. `history`
// is the full turn list ending with the latest user message. Throws AssistantError on failure
// (e.g. "unsupported" when WebGPU is absent).
export async function runChat(
  history: ChatTurn[],
  kb: string,
  onProgress?: (p: LoadProgress) => void,
  tier?: ModelTier,
): Promise<string> {
  // Retrieve the theory chunks relevant to the question and ground the prompt in them. Retrieval
  // failure is tolerated (we fall back to the static primer in buildChatMessages) EXCEPT for
  // "unsupported", which means no WebGPU — the chat model can't run either, so let it propagate.
  let reference = "";
  try {
    reference = formatContext(await retrieve(latestQuestion(history), 5, onProgress));
  } catch (e) {
    if (e instanceof AssistantError && e.code === "unsupported") throw e;
  }

  const { id, dtype } = resolveTier(tier);
  const generator = await loadGenerator(onProgress, id, dtype);
  let output: unknown;
  try {
    output = await generator(buildChatMessages(history, kb, reference), {
      max_new_tokens: MAX_NEW_TOKENS,
      do_sample: true,
      temperature: 0.7,
      top_p: 0.9,
      return_full_text: false,
    });
  } catch (e) {
    throw new AssistantError("failed", (e as Error).message);
  }
  const reply = extractReplyText(output).trim();
  if (!reply) throw new AssistantError("failed", "empty reply");
  return reply;
}
