import { useEffect, useRef, useState } from "react";

// Captures the `beforeinstallprompt` event so we can show our own Install
// button (Chromium no longer shows an automatic banner). Returns whether the
// app is installable and a prompt() trigger; hides once installed.
export function usePwaInstall() {
  const [canInstall, setCanInstall] = useState(false);
  const deferred = useRef(null);

  useEffect(() => {
    function onPrompt(e) {
      e.preventDefault();
      deferred.current = e;
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
