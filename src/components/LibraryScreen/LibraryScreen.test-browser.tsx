import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { render, cleanup, screen, within, fireEvent, waitFor, act } from "@testing-library/react";
import { useEffect, useRef } from "react";
import { I18nProvider } from "../../providers/I18nProvider/I18nProvider.tsx";
import { StoreProvider, useStore } from "../../providers/StoreProvider/StoreProvider.tsx";
import { RouteProvider } from "../../providers/RouteProvider/RouteProvider.tsx";
import LibraryScreen from "./LibraryScreen.tsx";

// Seed a known set of lessons once the store has hydrated, then signal ready. importLesson lets us
// set title + tags directly (createLesson only makes blank ones).
function Seed({ lessons }: { lessons: { title: string; tags?: string[] }[] }) {
  const { importLesson, hydrated } = useStore();
  const done = useRef(false);
  useEffect(() => {
    if (!hydrated || done.current) return;
    done.current = true;
    for (const l of lessons)
      importLesson({ title: l.title, tags: l.tags, cells: [{ id: "c", kind: "note", source: "" }] });
  }, [hydrated, importLesson, lessons]);
  return null;
}

function renderLibrary(lessons: { title: string; tags?: string[] }[]) {
  window.location.hash = "library";
  return render(
    <I18nProvider>
      <StoreProvider>
        <RouteProvider>
          <Seed lessons={lessons} />
          <LibraryScreen />
        </RouteProvider>
      </StoreProvider>
    </I18nProvider>,
  );
}

beforeEach(() => {
  window.location.hash = "library";
});
afterEach(() => {
  cleanup();
  window.location.hash = "";
});

const card = (title: string) => screen.getByText(title).closest("article") as HTMLElement;

describe("LibraryScreen", () => {
  it("renders a card per lesson with its title", async () => {
    renderLibrary([{ title: "Zeta Bach" }, { title: "Zeta Scales" }]);
    expect(await screen.findByText("Zeta Bach")).toBeTruthy();
    expect(screen.getByText("Zeta Scales")).toBeTruthy();
  });

  it("filters cards by the search query", async () => {
    renderLibrary([{ title: "Qux Bach" }, { title: "Qux Scales" }]);
    await screen.findByText("Qux Bach");
    fireEvent.change(screen.getByRole("textbox", { name: /search/i }), {
      target: { value: "scal" },
    });
    await waitFor(() => expect(screen.queryByText("Qux Bach")).toBeNull());
    expect(screen.getByText("Qux Scales")).toBeTruthy();
  });

  it("toggles a lesson's pin from the card", async () => {
    renderLibrary([{ title: "Pinnable Lesson" }]);
    await screen.findByText("Pinnable Lesson");
    fireEvent.click(within(card("Pinnable Lesson")).getByRole("button", { name: /^pin$/i }));
    // Pinning relocates the card into the Pinned section, so re-query it fresh.
    await waitFor(() =>
      within(card("Pinnable Lesson")).getByRole("button", { name: /unpin/i }),
    );
  });

  it("narrows to a single tag when its filter chip is pressed", async () => {
    renderLibrary([
      { title: "Tagged Repertoire", tags: ["repertoire"] },
      { title: "Tagged Technique", tags: ["technique"] },
    ]);
    await screen.findByText("Tagged Repertoire");
    // Scope to the filter chip row — the card's own tag chip shares the name.
    const filter = screen.getByRole("group", { name: /filter by tag/i });
    fireEvent.click(within(filter).getByRole("button", { name: /^repertoire/i }));
    await waitFor(() => expect(screen.queryByText("Tagged Technique")).toBeNull());
    expect(screen.getByText("Tagged Repertoire")).toBeTruthy();
  });

  it("opens a lesson (and closes the screen) when its title is clicked", async () => {
    renderLibrary([{ title: "Openable Lesson" }]);
    await screen.findByText("Openable Lesson");
    act(() => {
      fireEvent.click(screen.getByText("Openable Lesson"));
    });
    // closeScreen drops the #library hash → the screen unmounts its content.
    await waitFor(() => expect(screen.queryByText("Openable Lesson")).toBeNull());
  });
});
