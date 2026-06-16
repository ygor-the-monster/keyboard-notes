import React from "react";
import { createRoot } from "react-dom/client";
import ThemeProvider from "./providers/ThemeProvider/ThemeProvider.jsx";
import { StoreProvider } from "./providers/StoreProvider/StoreProvider.jsx";
import { PWAProvider } from "./providers/PWAProvider/PWAProvider.jsx";
import { EditingProvider } from "./providers/EditingProvider/EditingProvider.jsx";
import App from "./components/App/App.jsx";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ThemeProvider>
      <StoreProvider>
        <PWAProvider>
          <EditingProvider>
            <App />
          </EditingProvider>
        </PWAProvider>
      </StoreProvider>
    </ThemeProvider>
  </React.StrictMode>,
);
