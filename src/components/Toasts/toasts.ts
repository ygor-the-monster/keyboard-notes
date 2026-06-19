import { UNSTABLE_ToastQueue as ToastQueue } from "react-aria-components";

// App-wide toast queue (React Aria). A single module-level queue, like the old S2 ToastQueue, so any
// module — even non-React ones — can post a toast; <Toasts/> (rendered once in App) renders them.
export interface ToastContent {
  title: string;
  variant: "neutral" | "positive" | "negative";
  accent?: string; // optional CSS color for the leading bar — lets a toast carry a cell's hue
  actionLabel?: string;
  onAction?: () => void;
  timeout?: number; // drives the close ring; the Toast closes itself when the ring finishes
}

export const MAX_VISIBLE = 3;
export const toastQueue = new ToastQueue<ToastContent>({ maxVisibleToasts: MAX_VISIBLE });

// We track the live count ourselves (the queue only exposes the *visible* ones) so the region can
// show a "+N more" chip for those still queued. Every close goes through closeToast so it stays
// accurate — the Toast component drives its own dismissal (so the visible ring == the real timing).
let liveCount = 0;
export const liveToastCount = () => liveCount;
export function closeToast(key: string): void {
  liveCount = Math.max(0, liveCount - 1);
  toastQueue.close(key);
}

interface ToastOptions {
  actionLabel?: string;
  onAction?: () => void;
  timeout?: number; // auto-dismiss after ms; omit to persist until dismissed
  accent?: string;
}

const add = (variant: ToastContent["variant"], title: string, o: ToastOptions = {}) => {
  liveCount++;
  return toastQueue.add({
    title,
    variant,
    accent: o.accent,
    actionLabel: o.actionLabel,
    onAction: o.onAction,
    timeout: o.timeout,
  });
};

// Mirrors the old S2 ToastQueue.{neutral,positive,negative}(message, options) call shape.
export const toast = {
  neutral: (message: string, o?: ToastOptions) => add("neutral", message, o),
  positive: (message: string, o?: ToastOptions) => add("positive", message, o),
  negative: (message: string, o?: ToastOptions) => add("negative", message, o),
};
