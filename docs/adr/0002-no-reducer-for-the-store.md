# No reducer pattern for the store

The Lesson mutations (add/move/duplicate/delete/import, etc.) stay as methods on `StoreProvider`,
closing over `setState` + persistence. We deliberately did **not** extract a `(state, action) → state`
reducer with an action/dispatch layer — that pattern isn't a fit we want to maintain here.

This is recorded because the mutations are only testable through React, which a future architecture
review will flag and re-propose a reducer for. It should not.

## If testability is ever wanted

Extract the mutation bodies as **pure standalone functions** — `moveCellTo(state, id, index): AppState`,
`addCell(state, cell): AppState`, etc. — and have the provider call `setState(prev => fn(prev, …))`.
That gives the same testable, React-free core (the functions are the test surface) **without** action
objects, a dispatch switch, or a reducer. Keep `uid()` / `Date.now()` / factories in the provider so
the functions stay deterministic.
