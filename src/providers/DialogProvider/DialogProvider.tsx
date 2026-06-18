import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AlertDialog, DialogContainer } from "@react-spectrum/s2";
import { useI18n } from "../I18nProvider/I18nProvider.tsx";

export type DialogVariant = "confirmation" | "information" | "destructive" | "warning" | "error";

export interface DialogOptions {
  title?: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: DialogVariant;
}
type DialogArg = string | DialogOptions;
interface DialogConfig extends DialogOptions {
  alert?: boolean;
}

export interface DialogValue {
  confirm: (o: DialogArg) => Promise<boolean>;
  alert: (o: DialogArg) => Promise<void>;
}

const DialogContext = createContext<DialogValue | null>(null);

// App-wide, promise-based replacement for window.confirm / window.alert using the S2 AlertDialog.
// `opts` is a string (used as the title) or { title, message, confirmLabel, cancelLabel, variant }.
export function DialogProvider({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const [opts, setOpts] = useState<DialogConfig | null>(null);
  const resolveRef = useRef<((result: boolean) => void) | null>(null);

  const ask = useCallback((o: DialogArg, alertMode: boolean): Promise<boolean> => {
    const cfg: DialogConfig = typeof o === "string" ? { title: o } : { ...o };
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
  const settle = useCallback((result: boolean) => {
    const r = resolveRef.current;
    if (!r) return;
    resolveRef.current = null;
    setOpts(null);
    r(result);
  }, []);

  const api = useMemo<DialogValue>(
    () => ({
      confirm: (o) => ask(o, false),
      alert: (o) => ask(o, true).then(() => undefined),
    }),
    [ask],
  );

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

export function useDialog(): DialogValue {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error("useDialog must be used within DialogProvider");
  return ctx;
}
