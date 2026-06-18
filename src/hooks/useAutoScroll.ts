import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type RefObject,
  type SetStateAction,
} from "react";
import { PlayIcon as Play, PauseIcon as Pause } from "@phosphor-icons/react";
import type { Tool } from "../components/Toolbar/Toolbar.tsx";

const STEP = 0.4; // px per frame per speed unit

// Hands-free auto-scroll of the lesson's scroll container (Ultimate-Guitar style). Shared by the
// Cifra and PDF cells: scrolls the nearest `.app-scroll` ancestor while running, and stops once
// the block's bottom reaches the viewport centre (or the container bottoms out).
export function useAutoScroll(ref: RefObject<HTMLElement | null>) {
  const [scrolling, setScrolling] = useState(false);
  const [speed, setSpeed] = useState(2);
  const acc = useRef(0);

  useEffect(() => {
    if (!scrolling) return;
    const container = ref.current?.closest(".app-scroll") || document.scrollingElement;
    if (!container) return;
    let raf = 0;
    let stopped = false;
    const tick = () => {
      if (stopped) return;
      acc.current += speed * STEP;
      const px = Math.floor(acc.current);
      if (px >= 1) {
        container.scrollTop += px;
        acc.current -= px;
      }
      // Stop once the end of the block reaches the middle of the viewport (or we bottom out).
      const rect = container.getBoundingClientRect();
      const center = rect.top + container.clientHeight / 2;
      const blockBottom = ref.current?.getBoundingClientRect().bottom ?? Infinity;
      const atBottom = container.scrollTop + container.clientHeight >= container.scrollHeight - 1;
      if (blockBottom <= center || atBottom) {
        setScrolling(false);
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
    };
    // ref is stable; re-run only when scrolling/speed change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrolling, speed]);

  const toggle = () => setScrolling((v) => !v);
  return { scrolling, speed, toggle, setSpeed };
}

interface ScrollToolsArgs {
  t: (key: string) => string;
  scrolling: boolean;
  toggle: () => void;
  speed: number;
  setSpeed: Dispatch<SetStateAction<number>>;
}

// The shared Toolbar descriptors (play/pause toggle + 1–5× speed spinner) for auto-scroll.
export function buildScrollTools({
  t,
  scrolling,
  toggle,
  speed,
  setSpeed,
}: ScrollToolsArgs): Tool[] {
  return [
    {
      kind: "toggle",
      id: "scroll",
      icon: Play,
      altIcon: Pause,
      label: t("scroll.auto"),
      altLabel: t("scroll.stop"),
      value: scrolling,
      onToggle: toggle,
    },
    {
      kind: "spinner",
      id: "speed",
      label: t("scroll.speed"),
      display: `${speed}×`,
      onPrev: () => setSpeed((s) => Math.max(1, s - 1)),
      onNext: () => setSpeed((s) => Math.min(5, s + 1)),
      prevDisabled: speed <= 1,
      nextDisabled: speed >= 5,
    },
  ];
}
