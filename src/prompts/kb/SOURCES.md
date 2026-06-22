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

### Original (project-licensed)
| File | Provenance | License |
| --- | --- | --- |
| `fundamentals.md` | Original, written for this app | Project |
| `scales-and-modes.md` | Original | Project |
| `chords-and-sevenths.md` | Original | Project |
| `progressions-and-cadences.md` | Original | Project |
| `rhythm-and-meter.md` | Original | Project |
| `expression.md` | Original | Project |
| `notation-abc.md` | Original (app-specific ABC / chord-chart syntax) | Project |

### External (vendored under `vendor/`, CC BY-SA 4.0)
Each external source is vendored verbatim (so we redistribute it transparently per ShareAlike), and
every chunk it produces carries an attributing `source` field. The in-app tutor shows a visible
credit line (`chat.sources`). Derivative KB content from these is itself CC BY-SA 4.0.

| Source | Vendored at | Author | License | Used for |
| --- | --- | --- | --- | --- |
| [music-theory-data](https://github.com/seancolsen/music-theory-data) | `vendor/music-theory-data/` | Sean Colsen | CC BY-SA 4.0 | Chord qualities + a curated set of common scales, decoded from the semitone bitmask into prose (see the YAML adapter in `scripts/build-kb-index.mjs`). The full `Scales.yaml` is vendored; the adapter emits only common scales. |
| [Open Music Theory](https://openmusictheory.github.io/) | `vendor/open-music-theory/` | Shaffer, Hughes, Moseley et al. | CC BY-SA 4.0 | Selected chapters (embellishing/non-chord tones, harmonic functions), cleaned of Jekyll/image markup and chunked by heading. |

## Candidate external sources (not yet ingested)
- **Chordonomicon** (chord-progression dataset, CSV) — useful for progression questions; verify
  license (some chord datasets are CC BY-NC).
- **PDMX / KernScores / FMA / MTG-Jamendo** — score corpora and track metadata. Out of scope for a
  theory tutor (they answer "what piece/song", not theory questions); revisit only if scope expands
  to repertoire lookup.
