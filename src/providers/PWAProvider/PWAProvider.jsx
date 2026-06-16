import { createContext, useContext } from "react";
import { usePwaInstall } from "./PWAProvider.hooks.js";

const PWAContext = createContext({ canInstall: false, promptInstall() {} });

// Exposes the "Add to Home Screen" install state to the app.
export function PWAProvider({ children }) {
  const pwa = usePwaInstall();
  return <PWAContext.Provider value={pwa}>{children}</PWAContext.Provider>;
}

export const usePwa = () => useContext(PWAContext);
