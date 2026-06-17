import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { AlertDialog, DialogContainer } from "@react-spectrum/s2";
import { useI18n } from "../I18nProvider/I18nProvider.jsx";

const DialogContext = createContext(null);

// App-wide, promise-based replacement for window.confirm / window.alert using the S2
// AlertDialog. useDialog() → { confirm(opts) => Promise<boolean>, alert(opts) => Promise<void> }.
// `opts` is a string (used as the title) or { title, message, confirmLabel, cancelLabel, variant }.
export function DialogProvider({ children }) {
  const { t } = useI18n();
  const [opts, setOpts] = useState(null);
  const resolveRef = useRef(null);

  const ask = useCallback((o, alertMode) => {
    const cfg = typeof o === "string" ? { title: o } : { ...o };
    cfg.alert = alertMode;
    return new Promise((resolve) => {
      resolveRef.current = resolve;
      setOpts(cfg);
    });
  }, []);

  // Resolve exactly once (idempotent). A button press fires its handler AND the container's
  // onDismiss in the same click; the buttons resolve *synchronously* so they always win, while
  // onDismiss resolves false only on a microtask — after every sync handler has run — covering
  // Esc / outside-click without overriding a button choice, regardless of firing order.
  const settle = useCallback((result) => {
    const r = resolveRef.current;
    if (!r) return;
    resolveRef.current = null;
    setOpts(null);
    r(result);
  }, []);

  const api = useMemo(() => ({ confirm: (o) => ask(o, false), alert: (o) => ask(o, true) }), [ask]);

  return (
    <DialogContext.Provider value={api}>
      {children}
      <DialogContainer onDismiss={() => queueMicrotask(() => settle(false))}>
        {opts && (
          <AlertDialog
            variant={opts.variant || (opts.alert ? "information" : "confirmation")}
            title={opts.title || ""}
            primaryActionLabel={
              opts.confirmLabel || (opts.alert ? t("common.ok") : t("common.confirm"))
            }
            cancelLabel={opts.alert ? undefined : opts.cancelLabel || t("common.cancel")}
            autoFocusButton={opts.alert ? "primary" : "cancel"}
            onPrimaryAction={() => settle(true)}
            onCancel={() => settle(false)}
          >
            {opts.message || ""}
          </AlertDialog>
        )}
      </DialogContainer>
    </DialogContext.Provider>
  );
}

export function useDialog() {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error("useDialog must be used within DialogProvider");
  return ctx;
}
