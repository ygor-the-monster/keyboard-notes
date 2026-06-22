// On-device editing assistant: turns a plain-language instruction into an edit of a text-bearing
// cell's content — ABC (Score), Markdown (Note), or a chord chart (Cifra). Runs a small
// instruction-tuned LLM (Liquid LFM2.5-1.2B) entirely in the browser via Transformers.js + WebGPU
// — nothing leaves the device. The model is large, so the library + weights are loaded lazily on
// first use (kept out of the initial bundle, like abcjs/pdfjs) and cached by the browser after.
//
// The model is the unreliable part: a small model will occasionally emit malformed output. So its
// reply is never trusted raw — it's coerced into structured JSON, validated (ABC is re-parsed with
// abcjs; plain text just has to be non-empty), and re-prompted once if invalid. The validation
// loop, not the model, is what makes this safe.
import { getAbcjs, joinAbc } from "../../components/ScoreCell/ScoreCell.utils.ts";
import { renderMarkdown } from "../../components/NoteCell/NoteCell.utils.ts";
import { parseCifra } from "../../components/CifraCell/CifraCell.utils.ts";
import { resolveTier, type ModelTier } from "../aiModel/aiModel.ts";
// System prompts live as editable .md under src/prompts (imported as raw strings), not inline.
import SCORE_SYSTEM from "../../prompts/score-system.md?raw";
import MARKDOWN_SYSTEM from "../../prompts/markdown-system.md?raw";
import CHORDS_SYSTEM from "../../prompts/chords-system.md?raw";

// LFM2.5-1.2B-Instruct: purpose-built for on-device, strong instruction-following + structured
// output, ~1.2B params (a tolerable opt-in download). Swap this one constant for a different ONNX
// build (e.g. a Qwen2.5-Coder ONNX repo) if it ever preserves ABC syntax more reliably.
export const MODEL_ID = "LiquidAI/LFM2.5-1.2B-Instruct-ONNX";
const DTYPE = "q4"; // 4-bit weights — smallest download / memory; WebGPU runs them fine.
const MAX_NEW_TOKENS = 1024; // covers a full reformatted Note / chord chart, not just a short tune.

// What the model must return. Asking for both fields (even when only the body changes) keeps the
// contract uniform; an omitted header is treated as "leave the header as-is".
export interface AbcEdit {
  header?: string;
  body: string;
}

// A typed reason so the UI can show the right message (and so an unsupported browser is a clean,
// expected outcome rather than a thrown stack).
export type AssistantErrorCode = "unsupported" | "invalid" | "failed";
export class AssistantError extends Error {
  code: AssistantErrorCode;
  constructor(code: AssistantErrorCode, message?: string) {
    super(message ?? code);
    this.code = code;
    this.name = "AssistantError";
  }
}

// WebGPU is the only path we support: the multi-threaded WASM fallback needs cross-origin isolation
// (COOP/COEP) headers, which GitHub Pages can't set. So if WebGPU is absent we decline cleanly
// rather than fall back to a path that can't work here.
export async function isWebGpuAvailable(): Promise<boolean> {
  try {
    const gpu = (navigator as unknown as { gpu?: { requestAdapter(): Promise<unknown> } }).gpu;
    if (!gpu) return false;
    return (await gpu.requestAdapter()) != null;
  } catch {
    return false;
  }
}

// --- Prompt -------------------------------------------------------------------------------

// Build the chat messages. `retryNote`, when present, is appended after a failed first attempt so
// the model knows its previous output didn't parse.
export function buildMessages(
  instruction: string,
  header: string,
  body: string,
  retryNote?: string,
): { role: string; content: string }[] {
  const user = [
    `INSTRUCTION: ${instruction.trim()}`,
    "",
    "HEADER:",
    header,
    "",
    "BODY:",
    body,
    retryNote ? `\n${retryNote}` : "",
  ].join("\n");
  return [
    { role: "system", content: SCORE_SYSTEM.trim() },
    { role: "user", content: user },
  ];
}

// --- Parsing the reply (pure / unit-tested) -----------------------------------------------

// Pull the assistant text out of whatever Transformers.js returns: a chat run yields
// generated_text as the full message array (last item is the assistant turn); some configs return
// a plain string. Be liberal about the shape.
export function extractReplyText(output: unknown): string {
  const first = Array.isArray(output) ? output[0] : output;
  const gen = (first as { generated_text?: unknown })?.generated_text;
  if (typeof gen === "string") return gen;
  if (Array.isArray(gen)) {
    const last = gen[gen.length - 1] as { content?: unknown } | undefined;
    if (last && typeof last.content === "string") return last.content;
  }
  if (typeof first === "string") return first;
  return "";
}

// Coerce model text into an AbcEdit, or null if no usable JSON body is present. Tolerant of code
// fences and surrounding prose: grabs the first balanced {...} run and parses it. An empty/missing
// header means "keep the current header", so it's dropped here and merged by the caller.
export function parseAssistantReply(raw: string): AbcEdit | null {
  const json = firstJsonObject(raw);
  if (!json) return null;
  let obj: unknown;
  try {
    obj = JSON.parse(json);
  } catch {
    return null;
  }
  if (!obj || typeof obj !== "object") return null;
  const rec = obj as Record<string, unknown>;
  const body = typeof rec.body === "string" ? rec.body : null;
  if (body == null || !body.trim()) return null;
  const header = typeof rec.header === "string" && rec.header.trim() ? rec.header : undefined;
  return header ? { header, body } : { body };
}

// First balanced { … } run in the text, scanning brace depth (string-literal aware so a brace
// inside a JSON string value doesn't throw off the count).
function firstJsonObject(text: string): string | null {
  const start = text.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === "{") depth++;
    else if (c === "}" && --depth === 0) return text.slice(start, i + 1);
  }
  return null;
}

// --- Validation ---------------------------------------------------------------------------

// True when header+body parse to at least one tune with real music. abcjs.parseOnly throws or
// returns an empty/staffless tree for malformed input; either way we reject and re-prompt.
export async function isValidAbc(header: string, body: string): Promise<boolean> {
  if (!body.trim()) return false;
  try {
    const abcjs = await getAbcjs();
    const tunes = abcjs.parseOnly(joinAbc(header, body));
    if (!tunes?.length) return false;
    return tunes.some((tune) =>
      (tune.lines || []).some((line) => (line.staff || []).some((st) => (st.voices || []).length)),
    );
  } catch {
    return false;
  }
}

// --- Model lifecycle ----------------------------------------------------------------------

export interface LoadProgress {
  status: string; // "progress" while bytes stream, then "done"/"ready"
  progress?: number; // 0..100
  file?: string;
}

// The text-generation pipeline, created once per model and reused. Typed loosely because
// Transformers.js types aren't worth dragging through this seam (mirrors the abcjs `any` seam).
export type Generator = (
  messages: { role: string; content: string }[],
  opts: Record<string, unknown>,
) => Promise<unknown>;
export type Dtype = "q4" | "q4f16" | "q8" | "fp16" | "fp32";

// Cache keyed by model id, so the small editor model and the larger chat model coexist without
// reloading. Each value is the in-flight-or-resolved pipeline for that model.
const generators = new Map<string, Promise<Generator>>();

// Load (or reuse) a pipeline. `onProgress` fires repeatedly during the first download so the UI can
// show a percentage; later calls resolve instantly from cache. Defaults to the editor model.
export async function loadGenerator(
  onProgress?: (p: LoadProgress) => void,
  modelId: string = MODEL_ID,
  dtype: Dtype = DTYPE,
): Promise<Generator> {
  const cached = generators.get(modelId);
  if (cached) return cached;
  if (!(await isWebGpuAvailable())) throw new AssistantError("unsupported");
  const p = (async () => {
    const { pipeline } = await import("@huggingface/transformers");
    const gen = await pipeline("text-generation", modelId, {
      device: "webgpu",
      dtype,
      progress_callback: onProgress as never,
    });
    return gen as unknown as Generator;
  })().catch((e) => {
    generators.delete(modelId); // let a later attempt retry a transient download failure
    throw new AssistantError("failed", (e as Error).message);
  });
  generators.set(modelId, p);
  return p;
}

// --- Orchestration ------------------------------------------------------------------------

// Run one transform: load → generate → parse → validate, retrying the generate once with a note if
// the first reply is unusable. Returns the validated edit (header filled in from the current header
// when the model kept it). Throws AssistantError("invalid") if both attempts fail validation.
export async function runNotationTransform(
  instruction: string,
  header: string,
  body: string,
  onProgress?: (p: LoadProgress) => void,
  tier?: ModelTier,
): Promise<AbcEdit> {
  const { id, dtype } = resolveTier(tier);
  const generator = await loadGenerator(onProgress, id, dtype);
  const attempt = async (retryNote?: string): Promise<AbcEdit | null> => {
    let output: unknown;
    try {
      output = await generator(buildMessages(instruction, header, body, retryNote), {
        max_new_tokens: MAX_NEW_TOKENS,
        do_sample: false,
        return_full_text: false,
      });
    } catch (e) {
      throw new AssistantError("failed", (e as Error).message);
    }
    const edit = parseAssistantReply(extractReplyText(output));
    if (!edit) return null;
    const nextHeader = edit.header ?? header;
    if (!(await isValidAbc(nextHeader, edit.body))) return null;
    return { header: nextHeader, body: edit.body };
  };

  const first = await attempt();
  if (first) return first;
  const second = await attempt(
    "Your previous reply was not valid ABC or not valid JSON. Return ONLY the corrected JSON object.",
  );
  if (second) return second;
  throw new AssistantError("invalid");
}

// --- Single-text kinds (Markdown / chord charts) ------------------------------------------
// Score is special (header + body, abcjs-validated). Note and Cifra are single text blobs whose
// only validity check is "non-empty", so they share one orchestrator parameterised by a profile
// that just swaps the system prompt. The model returns {"content": "<full new text>"}.

export type TextKind = "markdown" | "chords";

const TEXT_PROFILES: Record<TextKind, string> = {
  markdown: MARKDOWN_SYSTEM.trim(),
  chords: CHORDS_SYSTEM.trim(),
};

// Each single-text kind gets a syntax loop symmetric to ABC's abcjs check: the candidate is run
// through the app's own renderer/parser, and rejected (→ re-prompt) if that throws or yields
// nothing usable. Markdown is permissive, so "renders to non-empty HTML" is the bar; a chord chart
// must parse to at least one block.
export const TEXT_VALIDATORS: Record<TextKind, (s: string) => boolean> = {
  markdown: (s) => {
    try {
      return !!renderMarkdown(s, "assistant-check").trim();
    } catch {
      return false;
    }
  },
  chords: (s) => {
    try {
      return parseCifra(s, 0).length > 0;
    } catch {
      return false;
    }
  },
};

// Pull a non-empty `content` string out of the model's JSON reply, or null. Mirrors
// parseAssistantReply but for the single-field text contract.
export function parseContentReply(raw: string): string | null {
  const json = firstJsonObject(raw);
  if (!json) return null;
  let obj: unknown;
  try {
    obj = JSON.parse(json);
  } catch {
    return null;
  }
  if (!obj || typeof obj !== "object") return null;
  const content = (obj as Record<string, unknown>).content;
  return typeof content === "string" && content.trim() ? content : null;
}

export function buildTextMessages(
  kind: TextKind,
  instruction: string,
  text: string,
  retryNote?: string,
): { role: string; content: string }[] {
  const user = [
    `INSTRUCTION: ${instruction.trim()}`,
    "",
    "DOCUMENT:",
    text,
    retryNote ? `\n${retryNote}` : "",
  ].join("\n");
  return [
    { role: "system", content: TEXT_PROFILES[kind] },
    { role: "user", content: user },
  ];
}

// Run one single-text transform (Note / Cifra): load → generate → parse → non-empty check, with one
// retry. Returns the new text. Throws AssistantError("invalid") if both attempts fail.
export async function runTextTransform(
  kind: TextKind,
  instruction: string,
  text: string,
  onProgress?: (p: LoadProgress) => void,
  tier?: ModelTier,
): Promise<string> {
  const { id, dtype } = resolveTier(tier);
  const generator = await loadGenerator(onProgress, id, dtype);
  const attempt = async (retryNote?: string): Promise<string | null> => {
    let output: unknown;
    try {
      output = await generator(buildTextMessages(kind, instruction, text, retryNote), {
        max_new_tokens: MAX_NEW_TOKENS,
        do_sample: false,
        return_full_text: false,
      });
    } catch (e) {
      throw new AssistantError("failed", (e as Error).message);
    }
    const content = parseContentReply(extractReplyText(output));
    if (content == null || !TEXT_VALIDATORS[kind](content)) return null;
    return content;
  };

  const first = await attempt();
  if (first) return first;
  const second = await attempt(
    "Your previous reply was not valid JSON or did not produce usable content. Return ONLY the corrected JSON object.",
  );
  if (second) return second;
  throw new AssistantError("invalid");
}
