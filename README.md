# 🎹 Piano Notes

A Jupyter-style notebook for **piano lessons** — mix written notes (Markdown),
**engraved music staves you can hear played back** (ABC notation), images you can
crop & annotate, and embedded PDF sheet music. Fully static, stored on-device,
and deployable to GitHub Pages. Built for a tablet.

## Features

- **Notebook of lessons** — switch / create / import from the top bar; auto-saved
  to the browser (`localStorage`).
- **Cells, in any order** (click a cell to edit, click away to render):
  - 📝 **Note** — Markdown with a WYSIWYG toolbar (bold, headings, lists,
    quotes, links, code) and clickable practice-task checkboxes.
  - 🎼 **Music** — [ABC notation](https://abcnotation.com/) rendered to a real
    staff, with a touch palette, tempo slider, grand-staff templates, and
    **acoustic-grand playback**.
  - 🖼️ **Image** — drop / paste / browse, then **crop** and **annotate** (pen +
    colors + undo) on a canvas.
  - 📄 **PDF** — embed external sheet music by file or URL.
- **🥁 Metronome** — sample-accurate (Web Audio lookahead scheduler), both in
  the top bar and per music cell (clicks at that cell's tempo).
- **📲 Installable PWA** — service worker for offline use + an Install button
  (Add to Home Screen); ideal on a tablet.
- **Export** — per-lesson JSON (backup / transfer) and Print → PDF.

## Tech stack

- **React 19** + **Spectrum 2** (`@react-spectrum/s2`) with the `style` macro
- **rolldown-vite** + `@vitejs/plugin-react-oxc` (oxc-powered)
- **abcjs** (notation + synth), **marked** (Markdown), **pdf.js** + **pdf-lib** (PDF),
  **@phosphor-icons/react** (icons)
- A light, manuscript-style sheet — ivory canvas, clean white cells, magenta/seafoam accents
- **oxlint** + **oxfmt** (lint/format)

## Develop

```bash
npm install
npm run dev            # Vite dev server
npm run lint           # oxlint
npm run format         # oxfmt (write)  — format:check to verify
npm run build          # production build → dist/
```

> Spectrum 2's `style` macro is compiled by `unplugin-parcel-macros` (configured
> in `vite.config.js`); the macro plugin must stay first in the plugin list.

## Deploy (GitHub Pages via Actions)

`.github/workflows/deploy.yml` lints, tests, builds, and publishes `dist/` to
Pages on every push to `main`.

1. Push this repo to GitHub.
2. **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. Push to `main` — the workflow builds and deploys; the URL appears in the
   Actions run and on the Pages settings page.

The Vite `base` is relative (`"./"`), so the build works at any project-pages
path (`https://<you>.github.io/<repo>/`). Pages serves HTTPS, required for MIDI.

## Install (PWA)

Once deployed over HTTPS, the app registers a service worker and precaches its
assets for offline use. In a supporting browser an **Install** button appears in
the top bar (or use the browser's "Add to Home Screen"). Google Fonts are
runtime-cached so the type still renders offline.

## ABC quick reference

| You want | Type |
|---|---|
| Notes (middle-C octave) | `C D E F G A B` |
| Octave up / down | `c` (up), `C,` (down), `c'` (up two) |
| Sharp / flat / natural | `^C` / `_B` / `=C` |
| Note length | `C2` (longer), `C/2` (shorter) |
| Rest · bar · repeat | `z` · `\|` · `:\|` |
| Chord · grand staff | `[CEG]` · use the **Template** menu |
