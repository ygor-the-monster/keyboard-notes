# Text editors stay uncontrolled (for native undo)

The Note, Score (header + body), and Cifra editors are **uncontrolled** textareas
(`defaultValue` + `ref` + `onChange`), not controlled (`value` + `onChange`). Toolbar edits are
applied through `document.execCommand("insertText", …)` so they land on the browser's native
undo stack — which is what makes **Cmd/Ctrl-Z work across both typing and toolbar actions**.

Recorded because a React reviewer's instinct is "make all inputs controlled"; doing so here would
regress native undo, force manual caret/selection management, and re-render the live preview on
every keystroke. So: leave them uncontrolled. (S2 form controls — Topbar title, sliders, pickers —
are controlled, which is correct for those.)
