import {
  PencilSimpleLineIcon as PencilSimpleLine,
  EraserIcon as Eraser,
  PaletteIcon as Palette,
  PaintBrushIcon as PaintBrush,
  DropHalfIcon as DropHalf,
  ArrowUUpLeftIcon as ArrowUUpLeft,
  ArrowUUpRightIcon as ArrowUUpRight,
  TrashSimpleIcon as TrashSimple,
} from "@phosphor-icons/react";
import type { AnnotationStroke } from "../../utils/cellKinds/cellKinds.ts";
import type { Tool } from "../Toolbar/Toolbar.tsx";

// Pen / highlighter colours — rainbow (Spectrum shades) + pink, black, white.
export const ANNOT_COLORS: { c: string; name: string }[] = [
  { c: "rgb(215,50,32)", name: "Red" },
  { c: "rgb(194,78,0)", name: "Orange" },
  { c: "rgb(219,164,0)", name: "Yellow" },
  { c: "rgb(5,131,78)", name: "Green" },
  { c: "rgb(59,99,251)", name: "Blue" },
  { c: "rgb(113,85,250)", name: "Indigo" },
  { c: "rgb(154,71,226)", name: "Violet" },
  { c: "rgb(217,35,97)", name: "Pink" },
  { c: "rgb(19,19,19)", name: "Black" },
  { c: "#ffffff", name: "White" },
];
// Stroke size as a fraction of the layer width.
export const ANNOT_THICKNESS: { key: string; nameKey: string; f: number; dot: number }[] = [
  { key: "s", nameKey: "annotate.fine", f: 1 / 500, dot: 7 },
  { key: "m", nameKey: "annotate.medium", f: 1 / 260, dot: 11 },
  { key: "l", nameKey: "annotate.large", f: 1 / 120, dot: 16 },
];
export const ANNOT_OPACITY: { a: number; nameKey: string }[] = [
  { a: 1, nameKey: "annotate.opaque" },
  { a: 0.66, nameKey: "annotate.medium" },
  { a: 0.33, nameKey: "annotate.light" },
];

export const thicknessFraction = (key: string): number =>
  (ANNOT_THICKNESS.find((tk) => tk.key === key) || ANNOT_THICKNESS[1]).f;

// Apply an alpha to an "rgb(…)" or "#hex" colour, yielding "rgba(…)".
export function withAlpha(c: string, a: number): string {
  if (c.startsWith("#")) {
    let h = c.slice(1);
    if (h.length === 3)
      h = h
        .split("")
        .map((x) => x + x)
        .join("");
    return `rgba(${parseInt(h.slice(0, 2), 16)},${parseInt(h.slice(2, 4), 16)},${parseInt(h.slice(4, 6), 16)},${a})`;
  }
  return c.replace(/^rgb\(/, "rgba(").replace(/\)$/, `,${a})`);
}

// Draw one stroke onto a context already scaled to CSS pixels (w × h = display size).
export function drawStroke(
  ctx: CanvasRenderingContext2D,
  stroke: AnnotationStroke,
  w: number,
  h: number,
): void {
  const pts = stroke.points;
  if (!pts || !pts.length) return;
  ctx.save();
  ctx.globalAlpha = stroke.opacity ?? 1;
  ctx.strokeStyle = stroke.color;
  ctx.fillStyle = stroke.color;
  const lw = Math.max(1.5, (stroke.width || 1 / 260) * w);
  ctx.lineWidth = lw;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  if (pts.length === 1) {
    ctx.beginPath();
    ctx.arc(pts[0][0] * w, pts[0][1] * h, lw / 2, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.moveTo(pts[0][0] * w, pts[0][1] * h);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0] * w, pts[i][1] * h);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawStrokes(
  ctx: CanvasRenderingContext2D,
  strokes: AnnotationStroke[],
  w: number,
  h: number,
): void {
  for (const s of strokes || []) drawStroke(ctx, s, w, h);
}

// Eraser hit-test: index of the last (topmost) stroke whose path passes within `tol` (normalised)
// of (nx, ny), or -1. Squared distances avoid sqrt in the hot loop.
export function hitStrokeIndex(
  strokes: AnnotationStroke[],
  nx: number,
  ny: number,
  tol: number,
): number {
  for (let i = strokes.length - 1; i >= 0; i--) {
    const pts = strokes[i].points;
    const pad = tol + (strokes[i].width || 0) / 2;
    const pad2 = pad * pad;
    for (let j = 0; j < pts.length; j++) {
      if (j === 0) {
        const dx = pts[0][0] - nx;
        const dy = pts[0][1] - ny;
        if (dx * dx + dy * dy <= pad2) return i;
      } else if (segDist2(pts[j - 1], pts[j], nx, ny) <= pad2) return i;
    }
  }
  return -1;
}

function segDist2(a: [number, number], b: [number, number], px: number, py: number): number {
  const vx = b[0] - a[0];
  const vy = b[1] - a[1];
  const wx = px - a[0];
  const wy = py - a[1];
  const len2 = vx * vx + vy * vy;
  let tparam = len2 ? (wx * vx + wy * vy) / len2 : 0;
  tparam = Math.max(0, Math.min(1, tparam));
  const dx = a[0] + tparam * vx - px;
  const dy = a[1] + tparam * vy - py;
  return dx * dx + dy * dy;
}

interface AnnotationToolsArgs {
  t: (key: string, vars?: Record<string, unknown>) => string;
  color: string;
  setColor: (c: string) => void;
  thick: string;
  setThick: (k: string) => void;
  opacity: number;
  setOpacity: (a: number) => void;
  eraser: boolean;
  setEraser: (v: boolean) => void;
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
  canUndo: boolean;
  canRedo: boolean;
  canClear: boolean;
}

// Build the unified-Toolbar tool descriptors for an annotation control set. Shared by the Image
// and PDF cells so their pen UI is identical.
export function buildAnnotationTools({
  t,
  color,
  setColor,
  thick,
  setThick,
  opacity,
  setOpacity,
  eraser,
  setEraser,
  onUndo,
  onRedo,
  onClear,
  canUndo,
  canRedo,
  canClear,
}: AnnotationToolsArgs): Tool[] {
  return [
    {
      kind: "toggle",
      id: "eraser",
      icon: PencilSimpleLine,
      altIcon: Eraser,
      label: t("annotate.pen"),
      altLabel: t("annotate.eraser"),
      value: eraser,
      onToggle: () => setEraser(!eraser),
    },
    {
      kind: "group",
      id: "annColor",
      icon: Palette,
      label: t("annotate.color"),
      options: ANNOT_COLORS.map((o) => ({
        id: o.name,
        swatch: o.c,
        label: t(`annotate.colors.${o.name}`),
        selected: color === o.c,
        onUse: () => {
          setColor(o.c);
          setEraser(false);
        },
      })),
    },
    {
      kind: "group",
      id: "annThick",
      icon: PaintBrush,
      label: t("annotate.thickness"),
      options: ANNOT_THICKNESS.map((o) => ({
        id: o.key,
        dot: o.dot,
        label: t("annotate.pen2", { name: t(o.nameKey) }),
        selected: thick === o.key,
        onUse: () => {
          setThick(o.key);
          setEraser(false);
        },
      })),
    },
    {
      kind: "group",
      id: "annOpacity",
      icon: DropHalf,
      label: t("annotate.opacity"),
      options: ANNOT_OPACITY.map((o) => ({
        id: o.nameKey,
        swatch: withAlpha(color, o.a),
        label: `${t(o.nameKey)} (${Math.round(o.a * 100)}%)`,
        selected: opacity === o.a,
        onUse: () => {
          setOpacity(o.a);
          setEraser(false);
        },
      })),
    },
    { kind: "sep" },
    {
      kind: "action",
      id: "annUndo",
      icon: ArrowUUpLeft,
      label: t("annotate.undo"),
      onUse: onUndo,
      disabled: !canUndo,
    },
    {
      kind: "action",
      id: "annRedo",
      icon: ArrowUUpRight,
      label: t("annotate.redo"),
      onUse: onRedo,
      disabled: !canRedo,
    },
    {
      kind: "action",
      id: "annClear",
      icon: TrashSimple,
      label: t("annotate.clear"),
      onUse: onClear,
      disabled: !canClear,
    },
  ];
}
