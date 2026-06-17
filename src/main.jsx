import React from "react";
import { createRoot } from "react-dom/client";
import ThemeProvider from "./providers/ThemeProvider/ThemeProvider.jsx";
import { I18nProvider } from "./providers/I18nProvider/I18nProvider.jsx";
import { DialogProvider } from "./providers/DialogProvider/DialogProvider.jsx";
import { StoreProvider } from "./providers/StoreProvider/StoreProvider.jsx";
import { PWAProvider } from "./providers/PWAProvider/PWAProvider.jsx";
import { EditingProvider } from "./providers/EditingProvider/EditingProvider.jsx";
import App from "./components/App/App.jsx";

createRoot(document.getElementById("root")).render(
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
