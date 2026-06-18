import { describe, it, expectTypeOf, assertType } from "vitest";
import type { Tool, ActionTool, SpinnerTool, ToggleTool } from "./Toolbar.tsx";

describe("Tool discriminated union", () => {
  it("each kind extracts to its own interface", () => {
    expectTypeOf<Extract<Tool, { kind: "action" }>>().toEqualTypeOf<ActionTool>();
    expectTypeOf<Extract<Tool, { kind: "spinner" }>>().toEqualTypeOf<SpinnerTool>();
    expectTypeOf<Extract<Tool, { kind: "toggle" }>>().toEqualTypeOf<ToggleTool>();
  });

  it("accepts well-formed tools of each kind", () => {
    assertType<Tool>({ kind: "sep" });
    assertType<Tool>({ kind: "action", id: "a", label: "A", onUse: () => {} });
    assertType<Tool>({ kind: "toggle", id: "t", label: "T", value: false, onToggle: () => {} });
  });

  it("rejects tools missing their kind's required fields", () => {
    // @ts-expect-error toggle requires value + onToggle
    assertType<Tool>({ kind: "toggle", id: "t", label: "T" });
    // @ts-expect-error spinner requires onPrev + onNext
    assertType<Tool>({ kind: "spinner", id: "s", label: "S" });
    // @ts-expect-error "mystery" is not a Tool kind
    assertType<Tool>({ kind: "mystery", id: "m", label: "M" });
  });
});
