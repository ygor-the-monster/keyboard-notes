import { useEffect, useRef, useState } from "react";
import { Button, DropZone, FileTrigger, Text } from "@react-spectrum/s2";
import {
  Crop,
  Check,
  ArrowCounterClockwise,
  ArrowClockwise,
  FlipHorizontal,
  FlipVertical,
  Sun,
  CircleHalf,
  Sparkle,
  ArrowUUpLeft,
  ImageSquare,
  Palette,
  PaintBrush,
  Drop,
  DropHalf,
  UploadSimple,
} from "@phosphor-icons/react";
import { useStore } from "../../providers/StoreProvider/StoreProvider.jsx";
import { loadImage, normalizeImage, fileToDataUrl } from "./ImageCell.utils.js";
import Toolbar from "../Toolbar/Toolbar.jsx";
import shared from "../../providers/ThemeProvider/ThemeProvider.module.css";
import { dropFull } from "./ImageCell.styled.jsx";
import css from "./ImageCell.module.css";

// Pen / text colors — rainbow (Spectrum shades) + pink, black, white.
const COLORS = [
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
// Stroke size as a fraction of image width.
const THICKNESS = [
  { key: "s", name: "Fine", f: 1 / 500, dot: 7 },
  { key: "m", name: "Medium", f: 1 / 260, dot: 11 },
  { key: "l", name: "Large", f: 1 / 120, dot: 16 },
];
// Pen opacity presets.
const OPACITY = [
  { a: 1, name: "Opaque" },
  { a: 0.66, name: "Medium" },
  { a: 0.33, name: "Light" },
];

// Apply an alpha to an "rgb(…)" or "#hex" color, yielding "rgba(…)".
function withAlpha(c, a) {
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

export default function ImageCell({ cell, editing }) {
  const { updateCell } = useStore();
  const canvasRef = useRef(null);
  const fileRef = useRef(null);
  const historyRef = useRef([]);
  const drawing = useRef(false);
  const snapRef = useRef(null); // canvas snapshot taken at stroke start
  const pointsRef = useRef([]); // current stroke's points
  const cropStart = useRef(null);
  const [mode, setMode] = useState("pen"); // 'pen' | 'crop'
  const [color, setColor] = useState(COLORS[0].c);
  const [thick, setThick] = useState("m");
  const [opacity, setOpacity] = useState(1);
  const [cropRect, setCropRect] = useState(null);

  const tf = () => (THICKNESS.find((t) => t.key === thick) || THICKNESS[1]).f;

  useEffect(() => {
    if (!editing || !cell.dataUrl || !canvasRef.current) return;
    let cancelled = false;
    loadImage(cell.dataUrl).then((img) => {
      if (cancelled || !canvasRef.current) return;
      const c = canvasRef.current;
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      c.getContext("2d").drawImage(img, 0, 0);
    });
    return () => {
      cancelled = true;
    };
  }, [cell.dataUrl, editing]);

  async function addFile(file) {
    if (!file || !file.type.startsWith("image/")) return;
    updateCell(cell.id, { dataUrl: await normalizeImage(await fileToDataUrl(file)) });
  }

  function pushHistory() {
    historyRef.current.push(cell.dataUrl);
    if (historyRef.current.length > 15) historyRef.current.shift();
  }
  const commitCanvas = () =>
    updateCell(cell.id, { dataUrl: canvasRef.current.toDataURL("image/jpeg", 0.9) });

  function canvasPoint(e) {
    const c = canvasRef.current;
    const r = c.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) / r.width) * c.width,
      y: ((e.clientY - r.top) / r.height) * c.height,
    };
  }
  function onPointerDown(e) {
    e.currentTarget.setPointerCapture?.(e.pointerId);
    const p = canvasPoint(e);
    if (mode === "crop") {
      cropStart.current = p;
      setCropRect({ x: p.x, y: p.y, w: 0, h: 0 });
    } else {
      pushHistory();
      drawing.current = true;
      // Snapshot the canvas so each frame redraws the whole stroke as one path — lets a
      // semi-transparent pen composite correctly instead of compounding at every segment.
      const c = canvasRef.current;
      const snap = document.createElement("canvas");
      snap.width = c.width;
      snap.height = c.height;
      snap.getContext("2d").drawImage(c, 0, 0);
      snapRef.current = snap;
      pointsRef.current = [p];
    }
  }
  function onPointerMove(e) {
    const p = canvasPoint(e);
    if (mode === "pen" && drawing.current) {
      const c = canvasRef.current;
      const ctx = c.getContext("2d");
      pointsRef.current.push(p);
      ctx.clearRect(0, 0, c.width, c.height);
      ctx.drawImage(snapRef.current, 0, 0);
      ctx.globalAlpha = opacity;
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(1.5, c.width * tf());
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      const pts = pointsRef.current;
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.stroke();
      ctx.globalAlpha = 1;
    } else if (mode === "crop" && cropStart.current) {
      const s = cropStart.current;
      setCropRect({
        x: Math.min(s.x, p.x),
        y: Math.min(s.y, p.y),
        w: Math.abs(p.x - s.x),
        h: Math.abs(p.y - s.y),
      });
    }
  }
  function onPointerUp() {
    if (mode === "pen" && drawing.current) {
      drawing.current = false;
      snapRef.current = null;
      commitCanvas();
    }
    if (mode === "crop") cropStart.current = null;
  }
  function applyCrop() {
    if (!cropRect || cropRect.w < 5 || cropRect.h < 5) return;
    pushHistory();
    const out = document.createElement("canvas");
    out.width = Math.round(cropRect.w);
    out.height = Math.round(cropRect.h);
    out
      .getContext("2d")
      .drawImage(
        canvasRef.current,
        cropRect.x,
        cropRect.y,
        cropRect.w,
        cropRect.h,
        0,
        0,
        out.width,
        out.height,
      );
    setCropRect(null);
    updateCell(cell.id, { dataUrl: out.toDataURL("image/jpeg", 0.9) });
  }
  function rotate(dir) {
    const c = canvasRef.current;
    if (!c) return;
    const t = document.createElement("canvas");
    t.width = c.height;
    t.height = c.width;
    const x = t.getContext("2d");
    x.translate(t.width / 2, t.height / 2);
    x.rotate((dir * Math.PI) / 2);
    x.drawImage(c, -c.width / 2, -c.height / 2);
    pushHistory();
    updateCell(cell.id, { dataUrl: t.toDataURL("image/jpeg", 0.9) });
  }
  function flip(horizontal) {
    const c = canvasRef.current;
    if (!c) return;
    const t = document.createElement("canvas");
    t.width = c.width;
    t.height = c.height;
    const x = t.getContext("2d");
    if (horizontal) {
      x.translate(c.width, 0);
      x.scale(-1, 1);
    } else {
      x.translate(0, c.height);
      x.scale(1, -1);
    }
    x.drawImage(c, 0, 0);
    pushHistory();
    updateCell(cell.id, { dataUrl: t.toDataURL("image/jpeg", 0.9) });
  }
  // Pixel adjustments via the Canvas API (brightness/contrast filters + a sharpen kernel).
  function adjust(op) {
    const c = canvasRef.current;
    if (!c) return;
    pushHistory();
    if (op === "sharpen") {
      sharpen(c);
    } else {
      const f = {
        "bright+": "brightness(1.08)",
        "bright-": "brightness(0.92)",
        "contrast+": "contrast(1.12)",
        "contrast-": "contrast(0.9)",
        "sat+": "saturate(1.2)",
        "sat-": "saturate(0.82)",
      }[op];
      const t = document.createElement("canvas");
      t.width = c.width;
      t.height = c.height;
      const x = t.getContext("2d");
      x.filter = f;
      x.drawImage(c, 0, 0);
      const cx = c.getContext("2d");
      cx.clearRect(0, 0, c.width, c.height);
      cx.drawImage(t, 0, 0);
    }
    commitCanvas();
  }
  function sharpen(c) {
    const ctx = c.getContext("2d");
    const w = c.width;
    const h = c.height;
    const src = ctx.getImageData(0, 0, w, h);
    const out = ctx.createImageData(w, h);
    const s = src.data;
    const o = out.data;
    const k = [0, -1, 0, -1, 5, -1, 0, -1, 0];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const oi = (y * w + x) * 4;
        for (let ch = 0; ch < 3; ch++) {
          let sum = 0;
          let ki = 0;
          for (let ky = -1; ky <= 1; ky++) {
            for (let kx = -1; kx <= 1; kx++) {
              const px = Math.min(w - 1, Math.max(0, x + kx));
              const py = Math.min(h - 1, Math.max(0, y + ky));
              sum += s[(py * w + px) * 4 + ch] * k[ki++];
            }
          }
          o[oi + ch] = sum < 0 ? 0 : sum > 255 ? 255 : sum;
        }
        o[oi + 3] = s[oi + 3];
      }
    }
    ctx.putImageData(out, 0, 0);
  }
  function undo() {
    const prev = historyRef.current.pop();
    if (prev != null) updateCell(cell.id, { dataUrl: prev });
  }

  // Compact view — image, fit and centered.
  if (!editing) {
    return cell.dataUrl ? (
      <img className="img-rendered" src={cell.dataUrl} alt="Lesson image" />
    ) : (
      <Text>No image — click to add one.</Text>
    );
  }

  if (!cell.dataUrl) {
    return (
      <div
        onPaste={(e) => {
          const item = [...e.clipboardData.items].find((i) => i.type.startsWith("image/"));
          if (item) addFile(item.getAsFile());
        }}
      >
        <DropZone
          onDrop={async (e) => {
            const f = e.items.find((i) => i.kind === "file");
            if (f) addFile(await f.getFile());
          }}
          styles={dropFull}
        >
          <div className={shared.mediaEmpty}>
            <ImageSquare size={40} aria-hidden />
            <span className={shared.mediaEmptyTitle}>Add an image</span>
            <FileTrigger
              acceptedFileTypes={["image/*"]}
              onSelect={(files) => files && addFile(files[0])}
            >
              <Button variant="primary">Browse…</Button>
            </FileTrigger>
          </div>
        </DropZone>
      </div>
    );
  }

  const r = canvasRef.current?.getBoundingClientRect();
  const scale = r && canvasRef.current ? r.width / canvasRef.current.width : 1;

  const pickColor = (c) => {
    setColor(c);
    if (mode === "crop") setMode("pen");
  };
  const pickThick = (k) => {
    setThick(k);
    if (mode === "crop") setMode("pen");
  };
  const pickOpacity = (a) => {
    setOpacity(a);
    if (mode === "crop") setMode("pen");
  };
  // Crop toggle: first press arms crop mode; second press confirms (applies) and returns to pen.
  const toggleCrop = () => {
    if (mode === "crop") {
      applyCrop();
      setMode("pen");
    } else {
      setMode("crop");
    }
  };

  const tools = [
    {
      kind: "group",
      id: "transform",
      icon: ArrowClockwise,
      label: "Transform",
      options: [
        { id: "rl", icon: ArrowCounterClockwise, label: "Rotate left", onUse: () => rotate(-1) },
        { id: "rr", icon: ArrowClockwise, label: "Rotate right", onUse: () => rotate(1) },
        { id: "mh", icon: FlipHorizontal, label: "Mirror horizontal", onUse: () => flip(true) },
        { id: "mv", icon: FlipVertical, label: "Mirror vertical", onUse: () => flip(false) },
      ],
    },
    {
      kind: "toggle",
      id: "crop",
      icon: Crop,
      altIcon: Check,
      label: "Crop",
      altLabel: "Apply crop",
      value: mode === "crop",
      onToggle: toggleCrop,
    },
    { kind: "sep" },
    {
      kind: "spinner",
      id: "bright",
      icon: Sun,
      label: "Brightness",
      onPrev: () => adjust("bright-"),
      onNext: () => adjust("bright+"),
    },
    {
      kind: "spinner",
      id: "contrast",
      icon: CircleHalf,
      label: "Contrast",
      onPrev: () => adjust("contrast-"),
      onNext: () => adjust("contrast+"),
    },
    {
      kind: "spinner",
      id: "sat",
      icon: Drop,
      label: "Saturation",
      onPrev: () => adjust("sat-"),
      onNext: () => adjust("sat+"),
    },
    {
      kind: "action",
      id: "sharpen",
      icon: Sparkle,
      label: "Sharpen",
      onUse: () => adjust("sharpen"),
    },
    { kind: "sep" },
    {
      kind: "group",
      id: "color",
      icon: Palette,
      label: "Color",
      options: COLORS.map((o) => ({
        id: o.name,
        swatch: o.c,
        label: o.name,
        selected: color === o.c,
        onUse: () => pickColor(o.c),
      })),
    },
    {
      kind: "group",
      id: "thick",
      icon: PaintBrush,
      label: "Thickness",
      options: THICKNESS.map((o) => ({
        id: o.key,
        dot: o.dot,
        label: `${o.name} pen`,
        selected: thick === o.key,
        onUse: () => pickThick(o.key),
      })),
    },
    {
      kind: "group",
      id: "opacity",
      icon: DropHalf,
      label: "Opacity",
      options: OPACITY.map((o) => ({
        id: o.name,
        swatch: withAlpha(color, o.a),
        label: `${o.name} (${Math.round(o.a * 100)}%)`,
        selected: opacity === o.a,
        onUse: () => pickOpacity(o.a),
      })),
    },
    { kind: "sep" },
    {
      kind: "action",
      id: "replace",
      icon: UploadSimple,
      label: "Replace image",
      onUse: () => fileRef.current?.click(),
    },
    { kind: "action", id: "undo", icon: ArrowUUpLeft, label: "Undo", onUse: undo },
  ];

  return (
    <div className={css.col}>
      <Toolbar label="Image" tools={tools} />
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files[0];
          e.target.value = "";
          if (f) addFile(f);
        }}
      />

      <div className={css.imgStage}>
        <canvas
          ref={canvasRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
        />
        {cropRect && (
          <div
            style={{
              position: "absolute",
              left: cropRect.x * scale,
              top: cropRect.y * scale,
              width: cropRect.w * scale,
              height: cropRect.h * scale,
              border: "2px dashed var(--s-magenta)",
              background: "var(--s-magenta-ring)",
              pointerEvents: "none",
            }}
          />
        )}
      </div>
    </div>
  );
}
