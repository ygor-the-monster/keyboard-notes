import { createContext, useContext, type ReactNode } from "react";
import { usePwaInstall, type PwaInstall } from "./PWAProvider.hooks.ts";

const PWAContext = createContext<PwaInstall>({ canInstall: false, promptInstall: async () => {} });

// Exposes the "Add to Home Screen" install state to the app.
export function PWAProvider({ children }: { children: ReactNode }) {
  const pwa = usePwaInstall();
  return <PWAContext.Provider value={pwa}>{children}</PWAContext.Provider>;
}

export const usePwa = (): PwaInstall => useContext(PWAContext);
