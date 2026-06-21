import { Component, type ErrorInfo, type ReactNode } from "react";

// A render error inside one Cell's body must not blank the whole Lesson. This boundary catches a
// throw from the wrapped cell body and shows a fallback in that cell's place — the Lesson's other
// cells, the toolbar, and the rail keep working, so the maker can still move, duplicate, or delete
// the broken cell (e.g. a malformed ABC score or a corrupt PDF). React error boundaries must be
// class components; this is the only class in the tree.
//
// `fallback` is a render prop given a `retry` that clears the error and re-renders the body.
// `resetKeys` auto-clears the error when any key changes (shallow compare) — passing the cell makes
// an edit that fixes the underlying data recover on its own, with no extra tap.
interface Props {
  children: ReactNode;
  fallback: (retry: () => void) => ReactNode;
  resetKeys?: readonly unknown[];
}

interface State {
  error: Error | null;
  prevKeys: readonly unknown[] | undefined;
}

function keysChanged(a: readonly unknown[] | undefined, b: readonly unknown[] | undefined): boolean {
  if (a === b) return false;
  if (!a || !b || a.length !== b.length) return true;
  return a.some((k, i) => !Object.is(k, b[i]));
}

export default class CellErrorBoundary extends Component<Props, State> {
  state: State = { error: null, prevKeys: this.props.resetKeys };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  // Clear a held error when resetKeys change (an edit that fixes the cell's data recovers on its
  // own). Done here — not in componentDidUpdate — to avoid a second render pass.
  static getDerivedStateFromProps(props: Props, state: State): Partial<State> | null {
    if (!keysChanged(state.prevKeys, props.resetKeys)) return null;
    return { prevKeys: props.resetKeys, error: state.error ? null : state.error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Log rather than swallow — a crashed cell is a real bug we want surfaced in the console, even
    // though the UI degrades gracefully.
    console.error("Cell render failed:", error, info.componentStack);
  }

  retry = () => this.setState({ error: null });

  render() {
    if (this.state.error) return this.props.fallback(this.retry);
    return this.props.children;
  }
}
