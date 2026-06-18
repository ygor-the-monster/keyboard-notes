import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Button, DropZone, FileTrigger } from "@react-spectrum/s2";
import EmptyState from "../EmptyState/EmptyState.tsx";
import {
  CropIcon as Crop,
  CheckIcon as Check,
  ArrowCounterClockwiseIcon as ArrowCounterClockwise,
  ArrowClockwiseIcon as ArrowClockwise,
  FlipHorizontalIcon as FlipHorizontal,
  FlipVerticalIcon as FlipVertical,
  SunIcon as Sun,
  CircleHalfIcon as CircleHalf,
  DropIcon as Drop,
  ImageSquareIcon as ImageSquare,
  UploadSimpleIcon as UploadSimple,
  ArrowUUpLeftIcon as ArrowUUpLeft,
  ArrowsOutIcon as ArrowsOut,
} from "@phosphor-icons/react";
import { useStore } from "../../providers/StoreProvider/StoreProvider.tsx";
import { useDialog } from "../../providers/DialogProvider/DialogProvider.tsx";
import { useI18n } from "../../providers/I18nProvider/I18nProvider.tsx";
import { DEFAULT_IMAGE_FILTER } from "../../cells/kinds.ts";
import type { CellOf, Crop as CropRect, ImageFilter } from "../../cells/kinds.ts";
import {
  loadImage,
  normalizeImage,
  fileToDataUrl,
  renderFiltered,
  composeCrop,
  rotateCrop,
  flipCrop,
} from "./ImageCell.utils.ts";
import { ANNOT_COLORS, buildAnnotationTools } from "../AnnotationLayer/AnnotationLayer.utils.ts";
import { useStrokeHistory } from "../AnnotationLayer/AnnotationLayer.hooks.ts";
import AnnotationLayer from "../AnnotationLayer/AnnotationLayer.tsx";
import Toolbar from "../Toolbar/Toolbar.tsx";
import type { GroupOption, Tool } from "../Toolbar/Toolbar.tsx";
import shared from "../../providers/ThemeProvider/ThemeProvider.module.css";
import { dropFull } from "./ImageCell.styled.ts";
import css from "./ImageCell.module.css";

const ADJUST_LIMIT = 6;
const clampStep = (n: number) => Math.max(-ADJUST_LIMIT, Math.min(ADJUST_LIMIT, n));
type Adjustable = "bright" | "contrast" | "sat";

export default function ImageCell({ cell, editing }: { cell: CellOf<"image">; editing: boolean }) {
  const { updateCell } = useStore();
  const { confirm } = useDialog();
  const { t } = useI18n();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const cropStart = useRef<[number, number] | null>(null);

  const [mode, setMode] = useState<"pen" | "crop">("pen");
  const [color, setColor] = useState(ANNOT_COLORS[0].c);
  const [thick, setThick] = useState("m");
  const [opacity, setOpacity] = useState(1);
  const [eraser, setEraser] = useState(false);
  const [cropRect, setCropRect] = useState<CropRect | null>(null); // live, normalised over display

  const filter = cell.filter || DEFAULT_IMAGE_FILTER;
  const strokes = cell.strokes || [];

  useEffect(() => {
    if (!cell.dataUrl) {
      imgRef.current = null;
      return;
    }
    let cancelled = false;
    loadImage(cell.dataUrl).then((img) => {
      if (cancelled) return;
      imgRef.current = img;
      if (canvasRef.current) renderFiltered(canvasRef.current, img, filter);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cell.dataUrl]);

  useEffect(() => {
    if (imgRef.current && canvasRef.current)
      renderFiltered(canvasRef.current, imgRef.current, filter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, editing]);

  async function addFile(file: File | null) {
    if (!file || !file.type.startsWith("image/")) return;
    updateCell(cell.id, {
      dataUrl: await normalizeImage(await fileToDataUrl(file)),
      filter: { ...DEFAULT_IMAGE_FILTER },
      strokes: [],
    });
  }

  const updateFilter = (patch: Partial<ImageFilter>) =>
    updateCell(cell.id, { filter: { ...filter, ...patch } });
  const setStrokes = (next: typeof strokes) => updateCell(cell.id, { strokes: next });
  const history = useStrokeHistory(strokes, setStrokes);

  function rotate(dir: number) {
    updateFilter({
      rotate: ((filter.rotate || 0) + dir * 90 + 360) % 360,
      crop: rotateCrop(filter.crop, dir),
    });
  }
  function flip(horizontal: boolean) {
    updateFilter({
      [horizontal ? "flipH" : "flipV"]: !filter[horizontal ? "flipH" : "flipV"],
      crop: flipCrop(filter.crop, horizontal),
    } as Partial<ImageFilter>);
  }
  const adjust = (field: Adjustable, delta: number) =>
    updateFilter({ [field]: clampStep((filter[field] || 0) + delta) } as Partial<ImageFilter>);

  // Crop point in display-normalised coordinates, read off the visible canvas box.
  function cropPoint(e: ReactPointerEvent): [number, number] {
    const r = canvasRef.current!.getBoundingClientRect();
    return [
      Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)),
      Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)),
    ];
  }
  function onCropDown(e: ReactPointerEvent) {
    e.currentTarget.setPointerCapture?.(e.pointerId);
    cropStart.current = cropPoint(e);
    setCropRect({ x: cropStart.current[0], y: cropStart.current[1], w: 0, h: 0 });
  }
  function onCropMove(e: ReactPointerEvent) {
    if (!cropStart.current) return;
    const [px, py] = cropPoint(e);
    const [sx, sy] = cropStart.current;
    setCropRect({
      x: Math.min(sx, px),
      y: Math.min(sy, py),
      w: Math.abs(px - sx),
      h: Math.abs(py - sy),
    });
  }
  const onCropUp = () => {
    cropStart.current = null;
  };
  function applyCrop() {
    if (cropRect && cropRect.w > 0.02 && cropRect.h > 0.02) {
      updateFilter({ crop: composeCrop(filter.crop, cropRect) });
    }
    setCropRect(null);
  }
  const toggleCrop = () => {
    if (mode === "crop") {
      applyCrop();
      setMode("pen");
    } else {
      setEraser(false);
      setMode("crop");
    }
  };
  async function revert() {
    const ok = await confirm({
      title: t("image.revertTitle"),
      message: t("image.revertMsg"),
      confirmLabel: t("image.revert"),
    });
    if (ok) updateCell(cell.id, { filter: { ...DEFAULT_IMAGE_FILTER }, strokes: [] });
  }

  // ---- empty state -----------------------------------------------------------
  if (!cell.dataUrl) {
    if (!editing) return <EmptyState kind="image" title={t("image.noImage")} compact />;
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
            if (f && f.kind === "file") addFile(await f.getFile());
          }}
          styles={dropFull}
        >
          <div className={shared.mediaEmpty}>
            <ImageSquare size={40} aria-hidden />
            <span className={shared.mediaEmptyTitle}>{t("image.addTitle")}</span>
            <FileTrigger
              acceptedFileTypes={["image/*"]}
              onSelect={(files) => files && addFile(files[0])}
            >
              <Button variant="primary">{t("common.browse")}</Button>
            </FileTrigger>
          </div>
        </DropZone>
      </div>
    );
  }

  const stage = (
    <div className={css.imgStage}>
      <canvas ref={canvasRef} className={css.baseCanvas} />
      <AnnotationLayer
        strokes={strokes}
        onChange={history.commit}
        active={editing && mode === "pen"}
        color={color}
        thick={thick}
        opacity={opacity}
        eraser={eraser}
      />
      {editing && mode === "crop" && (
        <div
          className={css.cropCapture}
          onPointerDown={onCropDown}
          onPointerMove={onCropMove}
          onPointerUp={onCropUp}
          onPointerCancel={onCropUp}
        >
          {cropRect && (
            <div
              className={css.cropRect}
              style={{
                left: `${cropRect.x * 100}%`,
                top: `${cropRect.y * 100}%`,
                width: `${cropRect.w * 100}%`,
                height: `${cropRect.h * 100}%`,
              }}
            />
          )}
        </div>
      )}
    </div>
  );

  if (!editing) return <div className={css.col}>{stage}</div>;

  const transformOptions: GroupOption[] = [
    {
      id: "rl",
      icon: ArrowCounterClockwise,
      label: t("image.rotateLeft"),
      onUse: () => rotate(-1),
    },
    { id: "rr", icon: ArrowClockwise, label: t("image.rotateRight"), onUse: () => rotate(1) },
    { id: "mh", icon: FlipHorizontal, label: t("image.mirrorH"), onUse: () => flip(true) },
    { id: "mv", icon: FlipVertical, label: t("image.mirrorV"), onUse: () => flip(false) },
  ];
  if (filter.crop)
    transformOptions.push({
      id: "rc",
      icon: ArrowsOut,
      label: t("image.resetCrop"),
      onUse: () => updateFilter({ crop: null }),
    });

  const tools: Tool[] = [
    {
      kind: "group",
      id: "transform",
      icon: ArrowClockwise,
      label: t("image.transform"),
      options: transformOptions,
    },
    {
      kind: "toggle",
      id: "crop",
      icon: Crop,
      altIcon: Check,
      label: t("image.crop"),
      altLabel: t("image.applyCrop"),
      value: mode === "crop",
      onToggle: toggleCrop,
    },
    {
      kind: "spinner",
      id: "bright",
      icon: Sun,
      label: t("image.brightness"),
      onPrev: () => adjust("bright", -1),
      onNext: () => adjust("bright", 1),
    },
    {
      kind: "spinner",
      id: "contrast",
      icon: CircleHalf,
      label: t("image.contrast"),
      onPrev: () => adjust("contrast", -1),
      onNext: () => adjust("contrast", 1),
    },
    {
      kind: "spinner",
      id: "sat",
      icon: Drop,
      label: t("image.saturation"),
      onPrev: () => adjust("sat", -1),
      onNext: () => adjust("sat", 1),
    },
    { kind: "sep" },
    ...buildAnnotationTools({
      t,
      color,
      setColor,
      thick,
      setThick,
      opacity,
      setOpacity,
      eraser,
      setEraser: (v: boolean) => {
        setEraser(v);
        if (v && mode === "crop") setMode("pen");
      },
      onUndo: history.undo,
      onRedo: history.redo,
      onClear: history.clear,
      canUndo: history.canUndo,
      canRedo: history.canRedo,
      canClear: history.canClear,
    }),
    { kind: "sep" },
    {
      kind: "action",
      id: "replace",
      icon: UploadSimple,
      label: t("image.replace"),
      onUse: () => fileRef.current?.click(),
    },
    { kind: "action", id: "revert", icon: ArrowUUpLeft, label: t("image.revert"), onUse: revert },
  ];

  return (
    <div className={css.col}>
      <Toolbar label={t("cell.image")} tools={tools} />
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) addFile(f);
        }}
      />
      {stage}
    </div>
  );
}
