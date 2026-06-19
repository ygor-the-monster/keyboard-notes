import { useEffect, useReducer, useState, type CSSProperties } from "react";
import {
  UNSTABLE_ToastRegion as ToastRegion,
  UNSTABLE_ToastList as ToastList,
  UNSTABLE_Toast as Toast,
  UNSTABLE_ToastContent as ToastBody,
  Button,
  Text,
  type ToastProps,
} from "react-aria-components";
import { XIcon as X } from "@phosphor-icons/react";
import { toastQueue, closeToast, liveToastCount, type ToastContent } from "./toasts.ts";
import s from "./Toasts.module.css";

const EXIT_MS = 220; // must match the toast-out animation in Toasts.module.css
const RING = 2 * Math.PI * 17; // close-ring circumference (r=17)

// Hand-rolled enter/exit: the card animates in on mount (CSS), and on dismissal we flip an `.exiting`
// class, wait for the collapse animation, then actually remove it from the queue. The close ring
// drives the auto-dismiss (onAnimationEnd → dismiss), so the visible countdown always matches the
// real timing — and pausing the ring on hover (CSS) pauses the dismissal too.
function ToastItem({ toast }: { toast: ToastProps<ToastContent>["toast"] }) {
  const [exiting, setExiting] = useState(false);
  const c = toast.content;

  const dismiss = () => {
    if (exiting) return;
    setExiting(true);
    window.setTimeout(() => closeToast(toast.key), EXIT_MS);
  };

  return (
    <Toast
      toast={toast}
      className={`${s.toast}${exiting ? ` ${s.exiting}` : ""}`}
      data-variant={c.variant}
      style={c.accent ? ({ "--toast-accent": c.accent } as CSSProperties) : undefined}
    >
      <ToastBody className={s.content}>
        <Text slot="title" className={s.msg}>
          {c.title}
        </Text>
      </ToastBody>
      {c.actionLabel && (
        <Button
          className={s.action}
          onPress={() => {
            c.onAction?.();
            dismiss();
          }}
        >
          {c.actionLabel}
        </Button>
      )}
      <div className={s.closeWrap}>
        {c.timeout != null && !exiting && (
          <svg className={s.ring} viewBox="0 0 40 40" aria-hidden>
            <circle className={s.ringTrack} cx="20" cy="20" r="17" />
            <circle
              className={s.ringFill}
              cx="20"
              cy="20"
              r="17"
              style={{ strokeDasharray: RING, animationDuration: `${c.timeout}ms` }}
              onAnimationEnd={dismiss}
            />
          </svg>
        )}
        <Button className={s.close} aria-label="Dismiss" onPress={dismiss}>
          <X size={16} aria-hidden />
        </Button>
      </div>
    </Toast>
  );
}

// Mounted once at the app root. Caps the stack at MAX_VISIBLE and shows a "+N more" chip for those
// still queued (they surface as visible toasts dismiss).
export default function Toasts() {
  const [, bump] = useReducer((n: number) => n + 1, 0);
  useEffect(() => toastQueue.subscribe(bump), []);
  const hidden = liveToastCount() - toastQueue.visibleToasts.length;

  return (
    <ToastRegion queue={toastQueue} className={s.region}>
      {hidden > 0 && <div className={s.more}>+{hidden} more</div>}
      <ToastList<ToastContent> className={s.list}>
        {({ toast }) => <ToastItem toast={toast} />}
      </ToastList>
    </ToastRegion>
  );
}
