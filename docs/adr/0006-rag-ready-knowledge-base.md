# The music tutor is grounded by a RAG-ready, committed retrieval index

The on-device music tutor (LessonChat) answers theory questions with a small (~1.2B) LLM. A small
model is unreliable at recall, so it must be **grounded** in reference text rather than trusted to
remember theory. The earlier approach stuffed one static primer (`music-kb.md`) into every prompt.
That works while the reference is tiny, but it doesn't scale: a larger corpus blows the context
window, and a small model reads a focused excerpt far better than a wall of text.

## Decision

Ground the tutor with **retrieval over a committed, self-describing vector index**, built from
Markdown sources we author, with a pipeline designed so new sources are a drop-in.

- **Sources** live in `src/prompts/kb/*.md`, one `##` section per retrievable chunk, each file
  carrying `title / topics / source / license` frontmatter. We author them (original prose), so no
  third-party licensing is entangled; provenance is tracked in `kb/SOURCES.md`.
- **A build step** (`scripts/build-kb-index.mjs`, `npm run kb:index`) embeds every chunk with a
  small sentence-transformer running in Node — the **same** `@huggingface/transformers` dependency
  the app already ships — and writes `public/kb-index.json`.
- **At runtime** (`src/utils/lessonKb/kbIndex.ts`) the tutor lazily fetches the index, embeds the
  question with the model the index declares, scores chunks by cosine similarity (brute force — the
  corpus is dozens of chunks), and injects the top-k into the prompt. `lessonChat.ts` falls back to
  the static primer if retrieval is unavailable, so the tutor is never left ungrounded.
- **Regeneration is CI's job** (`.github/workflows/kb-index.yml`): on demand or on any change under
  `src/prompts/kb/**`, it rebuilds the index and commits it to main — cloning the existing
  screenshot-regeneration workflow.

## Why these shapes

- **The index is self-describing.** It stores its own `model`, `dim`, `pooling`, `normalize`, and
  `queryPrefix`; the runtime embeds queries with exactly those settings. Build-time and runtime
  embeddings therefore cannot silently drift — the classic RAG footgun — because there is one
  source of truth and the runtime obeys it.
- **No vector database.** A committed JSON of `{text, vector}` plus brute-force cosine is simpler,
  smaller, diff-able, and offline-friendly. A DB/index library earns its keep at millions of
  vectors, not dozens.
- **Not precached.** Like the Transformers.js chunk, the index (and the embedding model) are part of
  the opt-in, WebGPU-only tutor. The service worker fetches the index stale-while-revalidate rather
  than precaching it onto the majority who never open the tutor.

## Boundaries

- **External sources are pluggable** — a source is just *files + an adapter emitting
  `{text, metadata}`*. Two are now ingested (both CC BY-SA 4.0, vendored under `src/prompts/kb/vendor/`
  with attribution carried into each chunk's `source` field and a visible in-app credit):
  **music-theory-data** (YAML → prose adapter for chord qualities + common scales) and **Open Music
  Theory** (selected Markdown chapters, cleaned + chunked). Derivative KB content from these is
  itself CC BY-SA. Score corpora and track-metadata datasets (PDMX, KernScores, FMA, MTG-Jamendo)
  remain out of scope: they answer "what piece/song", not theory.
- **Vectors are stored as float32 JSON.** At ~60 chunks the index is ~240 KB; int8 quantization is
  an obvious later optimization once the corpus grows, and the self-describing header leaves room to
  record it.
