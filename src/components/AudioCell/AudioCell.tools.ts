import {
  PlayIcon as Play,
  PauseIcon as Pause,
  MicrophoneIcon as Microphone,
  StopIcon as Stop,
  UploadSimpleIcon as UploadSimple,
  ScissorsIcon as Scissors,
  TrashSimpleIcon as TrashSimple,
  ArrowUUpLeftIcon as ArrowUUpLeft,
  MapPinIcon as MapPin,
} from "@phosphor-icons/react";
import type { Tool } from "../Toolbar/Toolbar.tsx";

type Sel = { start: number; end: number };

export function buildAudioTools({
  t,
  playing,
  togglePlay,
  rate,
  changeRate,
  sel,
  addMark,
  recording,
  toggleRec,
  trimToSel,
  deleteSel,
  openReplace,
  undo,
}: {
  t: (key: string, vars?: Record<string, string | number>) => string;
  playing: boolean;
  togglePlay: () => void;
  rate: number;
  changeRate: (d: number) => void;
  sel: Sel | null;
  addMark: () => void;
  recording: boolean;
  toggleRec: () => void;
  trimToSel: () => void;
  deleteSel: () => void;
  openReplace: () => void;
  undo: () => void;
}): Tool[] {
  return [
    {
      kind: "toggle",
      id: "play",
      icon: Play,
      altIcon: Pause,
      tone: "play",
      label: t("audio.play"),
      altLabel: t("audio.pause"),
      value: playing,
      onToggle: togglePlay,
    },
    {
      kind: "spinner",
      id: "speed",
      label: t("audio.speed"),
      display: `${rate}×`,
      onPrev: () => changeRate(-0.25),
      onNext: () => changeRate(0.25),
      prevDisabled: rate <= 0.5,
      nextDisabled: rate >= 1.5,
    },
    { kind: "sep" },
    { kind: "action", id: "mark", icon: MapPin, label: t("audio.addMark"), onUse: addMark },
    {
      kind: "toggle",
      id: "rec",
      icon: Microphone,
      altIcon: Stop,
      tone: "record",
      label: sel ? t("audio.recordSelection") : t("audio.recordCursor"),
      altLabel: t("audio.stopRecording"),
      value: recording,
      onToggle: toggleRec,
    },
    { kind: "sep" },
    {
      kind: "action",
      id: "trim",
      icon: Scissors,
      label: t("audio.trim"),
      onUse: trimToSel,
      disabled: !sel,
    },
    {
      kind: "action",
      id: "delsel",
      icon: TrashSimple,
      label: t("audio.deleteSelection"),
      onUse: deleteSel,
      disabled: !sel,
    },
    { kind: "sep" },
    {
      kind: "action",
      id: "replace",
      icon: UploadSimple,
      label: t("audio.replace"),
      onUse: openReplace,
    },
    { kind: "action", id: "undo", icon: ArrowUUpLeft, label: t("common.undo"), onUse: undo },
  ];
}
