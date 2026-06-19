import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ModalOverlay, Modal, Dialog, Heading, Button } from "react-aria-components";
import { useI18n } from "../I18nProvider/I18nProvider.tsx";
import s from "./DialogProvider.module.css";

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

// App-wide, promise-based replacement for window.confirm / window.alert using a React Aria modal.
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

  // Resolve exactly once (idempotent), then close. Buttons settle synchronously; an Esc / outside
  // click closes via onOpenChange → settle(false), which no-ops if a button already resolved.
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
      <ModalOverlay
        className={s.overlay}
        isOpen={!!opts}
        isDismissable={!opts?.alert}
        onOpenChange={(open) => {
          if (!open) settle(false);
        }}
      >
        <Modal className={s.modal}>
          <Dialog role="alertdialog" className={s.dialog}>
            {opts && (
              <>
                {opts.title && (
                  <Heading slot="title" className={s.title}>
                    {opts.title}
                  </Heading>
                )}
                {opts.message && <p className={s.message}>{opts.message}</p>}
                <div className={s.buttons}>
                  {!opts.alert && (
                    <Button className={s.cancel} autoFocus onPress={() => settle(false)}>
                      {opts.cancelLabel || t("common.cancel")}
                    </Button>
                  )}
                  <Button
                    className={s.confirm}
                    data-variant={opts.variant || (opts.alert ? "information" : "confirmation")}
                    autoFocus={opts.alert || undefined}
                    onPress={() => settle(true)}
                  >
                    {opts.confirmLabel || (opts.alert ? t("common.ok") : t("common.confirm"))}
                  </Button>
                </div>
              </>
            )}
          </Dialog>
        </Modal>
      </ModalOverlay>
    </DialogContext.Provider>
  );
}

export function useDialog(): DialogValue {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error("useDialog must be used within DialogProvider");
  return ctx;
}
