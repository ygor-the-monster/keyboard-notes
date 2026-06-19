# Piano Notes

A notebook for piano lessons: a maker mixes written notes, engraved staves you can hear,
chord charts, images, and sheet-music PDFs into a single lesson, stored on the device.

## Language

### Structure

**Notebook**:
The application itself — the Jupyter-style environment that holds the Library and edits Lessons.
_Avoid_: app, tool (when you mean the whole product)

**Library**:
The full on-device collection of Lessons.
_Avoid_: workspace, all notebooks

**Lesson**:
One document — an ordered list of Cells for a single piano lesson. The unit you create,
switch between, title, import, and export.
_Avoid_: notebook (that is the app), document, page, sheet

**Cell**:
One block within a Lesson. Cells are reorderable and each is of a single Kind.
_Avoid_: block, section, item

**Kind**:
The discriminator that fixes which of the seven kinds a Cell is (Note, Score, Cifra, Image,
PDF, Audio, External). The single source of truth for the closed set of kinds.
_Avoid_: type (overloaded), variant, flavor

### Cell kinds

**Note**:
A Cell of prose — Markdown text with practice-task checkboxes.
_Avoid_: text cell, markdown cell (in prose; the kind is "Note")

**Score**:
A Cell of engraved music — staff notation you can hear played back.
_Avoid_: music (too broad — a Cifra is music too), ABC, staff cell

**Cifra**:
A Cell of chords written over lyrics (a chord chart), transposable.
_Avoid_: chords, tab, lead sheet

**Image**:
A Cell holding one picture, croppable and annotatable.
_Avoid_: photo, picture cell

**PDF**:
A Cell embedding sheet-music PDF, page-navigable and annotatable.

**Audio**:
A Cell holding a recorded or imported sound clip, trimmable, with timeline Marks.
_Avoid_: sound, clip cell, recording

**External**:
A Cell pointing outside the notebook — an embedded video or web page by URL. The one kind that
isn't offline-self-contained, so it degrades to an offline placeholder when there's no connection.
Styled silver (achromatic), since color is reserved for native content.
_Avoid_: link, embed, bookmark

### Non-destructive overlays

The overlays below layer on top of the Original and are applied at view time — never baked into it.
Structural edits are the exception: PDF page operations and Audio trims intentionally rewrite the
Original (see ADR-0004).

**Original**:
The source bytes of an Image, PDF, or Audio Cell. The overlays never overwrite it; structural
PDF/Audio edits intentionally do (ADR-0004).
_Avoid_: source, raw, base

**Filter**:
The full reversible transform layer on an Image Cell — crop, rotate, flip, and color
(brightness/contrast/saturation) — applied at view time, never baked into the Original.
_Avoid_: edit, adjustment, effect

**Annotation**:
The freehand pen overlay on an Image or PDF Cell. On a PDF it is kept per page.
_Avoid_: drawing, markup, scribble

**Annotation Stroke**:
One freehand line within an Annotation.
_Avoid_: stroke (bare), path

**Mark**:
A saved point in time on an Audio Cell.
_Avoid_: cue, marker, annotation (that is the pen overlay)

### Score internals

**Staff**:
One horizontal line-system in a Score. A piano Score has two — right hand and left hand.
_Avoid_: voice, line, stave, part

### Sound

**Pitch**:
The equal-temperament note↔frequency math, referenced to a tunable A4 — the one place note names,
the chromatic (modulo-12) wrap, and Hz conversions live. The Tuner, Drone, and chord tools all read
through it.
_Avoid_: frequency (too narrow), note math

### Practice aids

**Pull Tab**:
A practice aid that produces or analyzes sound but holds no Lesson content — surfaced as a
tab that pulls out from the edge. The Metronome, Tuner, Drone, and Chord Builder are Pull Tabs.
_Avoid_: practice tool, widget, gadget, panel
