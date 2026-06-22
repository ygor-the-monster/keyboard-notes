# Knowledge-base sources

This folder holds the source documents for the music tutor's retrieval knowledge base. Each
`*.md` file is split into chunks (one per `##` heading) and embedded into `public/kb-index.json`
by `scripts/build-kb-index.mjs` (run via `npm run kb:index`, or the **Regenerate KB Index** GitHub
Action). The tutor retrieves the chunks most relevant to a question and grounds its answer in them.

## Adding a source
1. Add a `*.md` file here with YAML frontmatter: `title`, `topics`, `source`, `license`.
2. Keep each `##` section self-contained — chunks are retrieved in isolation, so a section must
   make sense without the ones around it (don't write "as shown above").
3. Push; the GitHub Action regenerates and commits `public/kb-index.json`. Or run `npm run kb:index`
   locally and commit the result.

Structured (non-Markdown) sources can be added later by writing a small adapter in the build
script that emits the same `{ text, title, source }` chunk shape.

## Current sources
| File | Provenance | License |
| --- | --- | --- |
| `fundamentals.md` | Original, written for this app | Project (proprietary, ships with the app) |
| `scales-and-modes.md` | Original | Project |
| `chords-and-sevenths.md` | Original | Project |
| `progressions-and-cadences.md` | Original | Project |
| `rhythm-and-meter.md` | Original | Project |
| `expression.md` | Original | Project |
| `notation-abc.md` | Original (app-specific ABC / chord-chart syntax) | Project |

## Candidate external sources (not yet ingested)
Evaluated for later expansion. Anything ingested must have its license verified and recorded here,
with attribution carried into each chunk's `source` field.

- **Music-Theory-Data** (normalized YAML: scales, chords, intervals) — strong fit; verify license.
- **Open Music Theory** (Markdown textbook) — ideal format, but the GitHub repo has **no LICENSE
  file**; confirm it is CC BY-SA (and carry attribution + share-alike) before ingesting.
- **Chordonomicon** (chord-progression dataset, CSV) — useful for progression questions; verify
  license (some chord datasets are CC BY-NC).
- **PDMX / KernScores / FMA / MTG-Jamendo** — score corpora and track metadata. Out of scope for a
  theory tutor (they answer "what piece/song", not theory questions); revisit only if scope expands
  to repertoire lookup.
