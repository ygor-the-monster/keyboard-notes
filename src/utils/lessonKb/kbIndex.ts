// Retrieval over the bundled music-theory knowledge base. At build time scripts/build-kb-index.mjs
// embeds every KB chunk into public/kb-index.json; here we lazily fetch that index, embed the user's
// question with the SAME model the index declares (it's self-describing — model, pooling, prefix all
// travel with it, so query and document embeddings can't drift apart), and return the closest chunks
// by cosine similarity. Brute-force search is fine: the corpus is dozens of chunks, not millions.
//
// The embedding model is small and loads lazily via the same @huggingface/transformers chunk as the
// chat LLM (excluded from the PWA precache — never paid for by users who don't open the tutor).
import { AssistantError, isWebGpuAvailable, type LoadProgress } from "../notationAssistant/notationAssistant.ts";

export interface IndexChunk {
  id: string;
  source: string;
  file: string;
  title: string;
  heading: string;
  text: string;
  vector: number[];
}
export interface KbIndex {
  schema: number;
  model: string;
  dim: number;
  pooling: string;
  normalize: boolean;
  queryPrefix: string;
  generatedAt: string;
  count: number;
  chunks: IndexChunk[];
}
export interface ScoredChunk extends IndexChunk {
  score: number;
}

// --- Scoring (pure / unit-tested) ---------------------------------------------------------

// Cosine similarity. Vectors in the index are normalized so this reduces to a dot product, but we
// compute the full form so it stays correct if an index is ever built without normalization.
export function cosineSim(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom ? dot / denom : 0;
}

// Score every chunk against the query vector and return the top k, highest first.
export function rankChunks(queryVec: number[], chunks: IndexChunk[], k: number): ScoredChunk[] {
  return chunks
    .map((c) => ({ ...c, score: cosineSim(queryVec, c.vector) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}

// Turn retrieved chunks into the reference block injected into the chat system prompt. Each chunk's
// text already leads with its "## heading", so they read as a stack of self-contained sections.
export function formatContext(scored: ScoredChunk[]): string {
  return scored.map((c) => c.text).join("\n\n");
}

// --- Index + embedder lifecycle -----------------------------------------------------------

let indexPromise: Promise<KbIndex> | null = null;

// Fetch (once) the committed index from the app's static root. Reset on failure so a later attempt
// can retry a transient fetch error.
export async function loadIndex(): Promise<KbIndex> {
  if (indexPromise) return indexPromise;
  indexPromise = fetch(`${import.meta.env.BASE_URL}kb-index.json`)
    .then((r) => {
      if (!r.ok) throw new Error(`kb-index.json ${r.status}`);
      return r.json() as Promise<KbIndex>;
    })
    .catch((e) => {
      indexPromise = null;
      throw e;
    });
  return indexPromise;
}

type Embedder = (
  text: string,
  opts: Record<string, unknown>,
) => Promise<{ data: ArrayLike<number> }>;

let embedderPromise: Promise<Embedder> | null = null;

// Load (once) the feature-extraction pipeline for the model the index was built with. Mirrors
// loadGenerator: WebGPU-only, lazy import, reset-on-failure. dtype q8 keeps the download small
// (~33 MB); minor q8-vs-fp32 numeric drift from the build is immaterial to cosine ranking.
export async function loadEmbedder(
  modelId: string,
  onProgress?: (p: LoadProgress) => void,
): Promise<Embedder> {
  if (embedderPromise) return embedderPromise;
  if (!(await isWebGpuAvailable())) throw new AssistantError("unsupported");
  embedderPromise = (async () => {
    const { pipeline } = await import("@huggingface/transformers");
    const ex = await pipeline("feature-extraction", modelId, {
      device: "webgpu",
      dtype: "q8",
      progress_callback: onProgress as never,
    });
    return ex as unknown as Embedder;
  })().catch((e) => {
    embedderPromise = null;
    throw new AssistantError("failed", (e as Error).message);
  });
  return embedderPromise;
}

// Embed a query using exactly the settings the index declares (prefix + pooling + normalization).
export async function embedQuery(
  index: KbIndex,
  query: string,
  onProgress?: (p: LoadProgress) => void,
): Promise<number[]> {
  const embedder = await loadEmbedder(index.model, onProgress);
  const out = await embedder(index.queryPrefix + query, {
    pooling: index.pooling,
    normalize: index.normalize,
  });
  return Array.from(out.data, Number);
}

// Retrieve the k chunks most relevant to a question. Throws AssistantError("unsupported") when
// WebGPU is absent (the caller treats that as fatal, since the chat model needs WebGPU too).
export async function retrieve(
  query: string,
  k = 5,
  onProgress?: (p: LoadProgress) => void,
): Promise<ScoredChunk[]> {
  const index = await loadIndex();
  const queryVec = await embedQuery(index, query, onProgress);
  return rankChunks(queryVec, index.chunks, k);
}
