import { Provider } from "@react-spectrum/s2";
import "@react-spectrum/s2/page.css";
import { IconContext } from "@phosphor-icons/react";
import "./ThemeProvider.globals.css";

// App theme: Spectrum 2 (light) + thin Phosphor icons + the global design-token layer.
export default function ThemeProvider({ children }) {
  return (
    <Provider background="base" colorScheme="light">
      <IconContext.Provider value={{ weight: "light", size: 20 }}>{children}</IconContext.Provider>
    </Provider>
  );
}
