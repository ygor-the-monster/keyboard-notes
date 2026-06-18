import { describe, it, expect, afterEach } from "vitest";
import {
  renderHook,
  act,
  cleanup,
  screen,
  within,
  waitFor,
  fireEvent,
} from "@testing-library/react";
import type { ReactNode } from "react";
import { Provider } from "@react-spectrum/s2";
import { I18nProvider } from "../I18nProvider/I18nProvider.tsx";
import { DialogProvider, useDialog } from "./DialogProvider.tsx";

afterEach(cleanup);

// Promise-based confirm/alert backed by the real S2 AlertDialog — needs a browser to render the
// modal overlay and dispatch real presses. DialogProvider reads useI18n, so it sits inside I18n.
const wrapper = ({ children }: { children: ReactNode }) => (
  <Provider background="base" colorScheme="light">
    <I18nProvider>
      <DialogProvider>{children}</DialogProvider>
    </I18nProvider>
  </Provider>
);

const dialogButton = async (name: RegExp | string) => {
  const dlg = await screen.findByRole("alertdialog");
  return within(dlg).getByRole("button", { name });
};

describe("DialogProvider", () => {
  it("confirm() resolves true when the primary action is pressed", async () => {
    const { result } = renderHook(() => useDialog(), { wrapper });
    let p!: Promise<boolean>;
    act(() => {
      p = result.current.confirm({ title: "Delete this cell?", confirmLabel: "Delete" });
    });
    expect(await screen.findByText("Delete this cell?")).toBeTruthy();
    fireEvent.click(await dialogButton("Delete"));
    await expect(p).resolves.toBe(true);
  });

  it("confirm() resolves false when cancelled, then closes", async () => {
    const { result } = renderHook(() => useDialog(), { wrapper });
    let p!: Promise<boolean>;
    act(() => {
      p = result.current.confirm({ title: "Sure?", cancelLabel: "Cancel" });
    });
    fireEvent.click(await dialogButton("Cancel"));
    await expect(p).resolves.toBe(false);
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
  });

  it("alert() resolves once the acknowledge button is pressed", async () => {
    const { result } = renderHook(() => useDialog(), { wrapper });
    let done = false;
    act(() => void result.current.alert("Heads up").then(() => (done = true)));
    fireEvent.click(await dialogButton(/ok/i));
    await waitFor(() => expect(done).toBe(true));
  });
});
