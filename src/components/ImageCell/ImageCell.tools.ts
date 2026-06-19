import {
  CropIcon as Crop,
  CheckIcon as Check,
  ArrowClockwiseIcon as ArrowClockwise,
  SunIcon as Sun,
  CircleHalfIcon as CircleHalf,
  DropIcon as Drop,
  UploadSimpleIcon as UploadSimple,
  ArrowUUpLeftIcon as ArrowUUpLeft,
} from "@phosphor-icons/react";
import type { GroupOption, Tool } from "../Toolbar/Toolbar.tsx";

type Adjustable = "bright" | "contrast" | "sat";

// Builds the ImageCell toolbar tools, in order. Pure function of its args: the annotation tools
// are built by the caller (which owns the eraser/mode wiring) and PLACED in the middle here, so
// this builder preserves the original layout without calling buildAnnotationTools itself.
export function buildImageTools({
  t,
  transformOptions,
  mode,
  toggleCrop,
  adjust,
  revert,
  openReplace,
  annotationTools,
}: {
  t: (key: string) => string;
  transformOptions: GroupOption[];
  mode: "pen" | "crop";
  toggleCrop: () => void;
  adjust: (field: Adjustable, delta: number) => void;
  revert: () => void;
  openReplace: () => void;
  annotationTools: Tool[];
}): Tool[] {
  return [
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
    ...annotationTools,
    { kind: "sep" },
    {
      kind: "action",
      id: "replace",
      icon: UploadSimple,
      label: t("image.replace"),
      onUse: openReplace,
    },
    { kind: "action", id: "revert", icon: ArrowUUpLeft, label: t("image.revert"), onUse: revert },
  ];
}
