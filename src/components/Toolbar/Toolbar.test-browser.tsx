import { describe, it, expect, afterEach, vi } from "vitest";
import { render, cleanup, screen, fireEvent } from "@testing-library/react";
import { Provider } from "@react-spectrum/s2";
import Toolbar from "./Toolbar.tsx";
import type { Tool } from "./Toolbar.tsx";

afterEach(cleanup);

const renderToolbar = (tools: Tool[]) =>
  render(
    <Provider background="base" colorScheme="light">
      <Toolbar label="Test tools" tools={tools} />
    </Provider>,
  );

describe("Toolbar (real S2 buttons)", () => {
  it("renders a labelled toolbar and fires an action tool's onUse", () => {
    const onUse = vi.fn();
    renderToolbar([{ kind: "action", id: "bold", char: "B", label: "Bold", onUse }]);
    expect(screen.getByRole("toolbar", { name: "Test tools" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Bold" }));
    expect(onUse).toHaveBeenCalledTimes(1);
  });

  it("fires a toggle tool's onToggle and labels it by its current value", () => {
    const onToggle = vi.fn();
    renderToolbar([
      {
        kind: "toggle",
        id: "scroll",
        char: "P",
        altChar: "S",
        label: "Play",
        altLabel: "Stop",
        value: false,
        onToggle,
      },
    ]);
    // value=false → primary label
    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("drives a spinner and disables the guarded end", () => {
    const onPrev = vi.fn();
    const onNext = vi.fn();
    renderToolbar([
      {
        kind: "spinner",
        id: "speed",
        label: "Speed",
        display: "2×",
        onPrev,
        onNext,
        prevDisabled: true,
      },
    ]);
    expect(screen.getByText("2×")).toBeTruthy();
    const prev = screen.getByRole("button", { name: "Speed: previous" }) as HTMLButtonElement;
    expect(prev.disabled).toBe(true);
    fireEvent.click(prev);
    expect(onPrev).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Speed: next" }));
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it("expands a group, picks an option, and collapses again", () => {
    const onUse = vi.fn();
    renderToolbar([
      {
        kind: "group",
        id: "list",
        char: "L",
        label: "List",
        options: [{ id: "ul", char: "•", label: "Bullet", onUse }],
      },
    ]);
    const group = screen.getByRole("button", { name: "List" });
    expect(group.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(group);
    expect(screen.getByRole("button", { name: "List" }).getAttribute("aria-expanded")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Bullet" }));
    expect(onUse).toHaveBeenCalledTimes(1);
    // picking an option collapses the group
    expect(screen.getByRole("button", { name: "List" }).getAttribute("aria-expanded")).toBe(
      "false",
    );
  });

  it("skips separators without rendering a button for them", () => {
    renderToolbar([
      { kind: "action", id: "a", char: "A", label: "Aye", onUse: () => {} },
      { kind: "sep" },
      { kind: "action", id: "b", char: "B", label: "Bee", onUse: () => {} },
    ]);
    expect(screen.getAllByRole("button")).toHaveLength(2);
  });
});
