import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from "react";
import {
  drawStrokes,
  drawStroke,
  hitStrokeIndex,
  thicknessFraction,
} from "./AnnotationLayer.utils.ts";
import type { AnnotationStroke } from "../../utils/cellKinds/cellKinds.ts";
import css from "./AnnotationLayer.module.css";

// A transparent canvas that captures freehand strokes and renders them in normalised coordinates
// over whatever it's laid on top of (an image or a PDF page). Fully non-destructive: it never
// touches the underlying media — strokes live in `strokes` and flow out through `onChange`. The
// host must be `position: relative`.
export default function AnnotationLayer({
  strokes,
  onChange,
  active = false,
  color = "rgb(215,50,32)",
  thick = "m",
  opacity = 1,
  eraser = false,
}: {
  strokes: AnnotationStroke[];
  onChange: (next: AnnotationStroke[]) => void;
  active?: boolean;
  color?: string;
  thick?: string;
  opacity?: number;
  eraser?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const liveRef = useRef<AnnotationStroke | null>(null); // in-progress stroke
  const workingRef = useRef<AnnotationStroke[]>(strokes); // authoritative copy during an erase drag
  workingRef.current = strokes;

  // Size the backing store to the displayed box (× dpr) and repaint committed strokes.
  function repaint() {
    const cv = canvasRef.current;
    if (!cv) return;
    const rect = cv.getBoundingClientRect();
    const w = rect.width || 1;
    const h = rect.height || 1;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = Math.round(w * dpr);
    cv.height = Math.round(h * dpr);
    const ctx = cv.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    drawStrokes(ctx, workingRef.current, w, h);
    if (liveRef.current) drawStroke(ctx, liveRef.current, w, h);
  }

  useEffect(() => {
    repaint();
    const cv = canvasRef.current;
    if (!cv || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => repaint());
    ro.observe(cv);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [strokes]);

  function norm(e: ReactPointerEvent): [number, number] {
    const rect = canvasRef.current!.getBoundingClientRect();
    return [
      Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)),
      Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height)),
    ];
  }

  function eraseAt(pt: [number, number]) {
    const idx = hitStrokeIndex(workingRef.current, pt[0], pt[1], 0.012);
    if (idx >= 0) {
      const next = workingRef.current.slice();
      next.splice(idx, 1);
      workingRef.current = next;
      onChange(next);
      repaint();
    }
  }

  function onDown(e: ReactPointerEvent) {
    if (!active) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    drawingRef.current = true;
    const pt = norm(e);
    if (eraser) {
      eraseAt(pt);
    } else {
      liveRef.current = { color, width: thicknessFraction(thick), opacity, points: [pt] };
      repaint();
    }
  }

  function onMove(e: ReactPointerEvent) {
    if (!active || !drawingRef.current) return;
    const pt = norm(e);
    if (eraser) {
      eraseAt(pt);
    } else if (liveRef.current) {
      liveRef.current.points.push(pt);
      repaint();
    }
  }

  function onUp() {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    if (!eraser && liveRef.current && liveRef.current.points.length) {
      onChange([...workingRef.current, liveRef.current]);
    }
    liveRef.current = null;
  }

  return (
    <canvas
      ref={canvasRef}
      className={`${css.layer} ${active ? css.active : ""}`}
      data-eraser={eraser ? "" : undefined}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
    />
  );
}
