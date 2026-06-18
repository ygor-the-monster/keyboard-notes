import React from "react";
import { createRoot } from "react-dom/client";
import ThemeProvider from "./providers/ThemeProvider/ThemeProvider.tsx";
import { I18nProvider } from "./providers/I18nProvider/I18nProvider.tsx";
import { DialogProvider } from "./providers/DialogProvider/DialogProvider.tsx";
import { StoreProvider } from "./providers/StoreProvider/StoreProvider.tsx";
import { PWAProvider } from "./providers/PWAProvider/PWAProvider.tsx";
import { EditingProvider } from "./providers/EditingProvider/EditingProvider.tsx";
import App from "./components/App/App.jsx";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemeProvider>
      <I18nProvider>
        <DialogProvider>
          <StoreProvider>
            <PWAProvider>
              <EditingProvider>
                <App />
              </EditingProvider>
            </PWAProvider>
          </StoreProvider>
        </DialogProvider>
      </I18nProvider>
    </ThemeProvider>
  </React.StrictMode>,
);
