import { useEffect, useRef, useState } from "react";

export interface PwaInstall {
  canInstall: boolean;
  promptInstall: () => Promise<void>;
}

// Not in lib.dom (it's a WICG proposal), so we declare the shape we use.
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

// Captures the `beforeinstallprompt` event so we can show our own Install button (Chromium no
// longer shows an automatic banner). Returns whether the app is installable and a prompt()
// trigger; hides once installed. The event type is non-standard, so it's held as `any`.
export function usePwaInstall(): PwaInstall {
  const [canInstall, setCanInstall] = useState(false);
  const deferred = useRef<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    function onPrompt(e: Event) {
      e.preventDefault();
      deferred.current = e as BeforeInstallPromptEvent;
      setCanInstall(true);
    }
    function onInstalled() {
      deferred.current = null;
      setCanInstall(false);
    }
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function promptInstall() {
    const e = deferred.current;
    if (!e) return;
    e.prompt();
    await e.userChoice;
    deferred.current = null;
    setCanInstall(false);
  }

  return { canInstall, promptInstall };
}
