import { describe, it, expectTypeOf, assertType } from "vitest";
import type { Cell, CellOf, Kind } from "./kinds.ts";

describe("Cell discriminated union", () => {
  it("CellOf<K> narrows to that kind's own fields", () => {
    expectTypeOf<CellOf<"image">>().toHaveProperty("filter");
    expectTypeOf<CellOf<"image">>().toHaveProperty("strokes");
    expectTypeOf<CellOf<"score">>().toHaveProperty("header");
    expectTypeOf<CellOf<"score">>().toHaveProperty("body");
    expectTypeOf<CellOf<"audio">>().toHaveProperty("marks");
    expectTypeOf<CellOf<"note">>().toHaveProperty("source");
  });

  it("the discriminant is exactly the Kind union", () => {
    expectTypeOf<Cell["kind"]>().toEqualTypeOf<Kind>();
  });

  it("a score cell isn't assignable where an image cell is required", () => {
    // @ts-expect-error score lacks the image-only fields (dataUrl / filter / strokes)
    assertType<CellOf<"image">>({ id: "1", kind: "score", header: "", body: "" });
  });

  it("image-only fields aren't visible on a bare Cell", () => {
    const cell = {} as Cell;
    // @ts-expect-error `filter` only exists after narrowing on cell.kind === "image"
    cell.filter;
  });
});
