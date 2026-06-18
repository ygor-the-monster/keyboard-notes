# Incremental migration to TypeScript with tsgo and erasable-only syntax

We are migrating Piano Notes from plain JavaScript to TypeScript so that closed sets
like the Cell `Kind` registry are forced to stay in sync at compile time
(`Record<Kind, …>` exhaustiveness) and the `Cell` discriminated union narrows by `kind`.

The migration is **incremental** (`allowJs: true`, `strict: true`): we convert files as we
touch them, starting with the Cell-kind registry (`src/cells/`), while the rest stay `.jsx`.

Type-checking runs on **tsgo** (`@typescript/native-preview`) via a `typecheck` script in CI —
not `tsc`. The runtime build is unchanged: `@vitejs/plugin-react-oxc` strips types per file
and does no type-directed transform.

## Considered Options

- **JSDoc + `tsc --checkJs`** — keeps `.js` files, but verbose and slower to author than real `.ts`.
- **Runtime guard in plain JS** — a boot-time assertion that registry keys match `KINDS`; rejected
  because the sync guarantee is wanted at author time, not at runtime.
- **Big-bang conversion** — rejected as an unreviewable, blocking diff across ~50 files.

## Consequences

- **`erasableSyntaxOnly: true`** is required so oxc can strip types per file with no runtime
  transform. This forbids `enum`, `namespace`, parameter properties, and `import =`. Kinds are
  therefore modelled as `const KINDS = [...] as const` + `type Kind = typeof KINDS[number]`,
  never a TS `enum`.
- **`verbatimModuleSyntax` + `isolatedModules`** are on, so type-only imports must use
  `import type`.
- Ambient declarations are needed for non-JS imports: `*.module.css`, `*.svg?raw`, and the
  Spectrum `style` macro import (`with { type: "macro" }`).
