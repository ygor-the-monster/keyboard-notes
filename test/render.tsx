// Shared render helpers for browser component tests. Wraps a tree in the same provider stack the
// app uses (I18n + Store + Editing + Dialog), so cell/toolbar components render the way they do in
// production. Lives outside src/ as test support (not a colocated spec).
import type { ReactElement, ReactNode } from "react";
import { render } from "@testing-library/react";
import { I18nProvider } from "../src/providers/I18nProvider/I18nProvider.tsx";
import { StoreProvider } from "../src/providers/StoreProvider/StoreProvider.tsx";
import { EditingProvider } from "../src/providers/EditingProvider/EditingProvider.tsx";
import { DialogProvider } from "../src/providers/DialogProvider/DialogProvider.tsx";

export function AllProviders({ children }: { children: ReactNode }) {
  return (
    <I18nProvider>
      <StoreProvider>
        <EditingProvider>
          <DialogProvider>{children}</DialogProvider>
        </EditingProvider>
      </StoreProvider>
    </I18nProvider>
  );
}

export function renderWithProviders(ui: ReactElement) {
  return render(ui, { wrapper: AllProviders });
}
