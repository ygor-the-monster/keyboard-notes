import { describe, it, expect } from "vitest";
import { uid } from "./id.ts";

describe("uid", () => {
  it("is prefixed and well-formed", () => {
    expect(uid()).toMatch(/^id-[a-z0-9]+$/);
  });
  it("is collision-resistant across many calls", () => {
    const ids = new Set(Array.from({ length: 2000 }, () => uid()));
    expect(ids.size).toBe(2000);
  });
});
