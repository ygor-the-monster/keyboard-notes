import { ArrowUUpLeftIcon as ArrowUUpLeft } from "@phosphor-icons/react";
import type { Tool } from "../Toolbar/Toolbar.tsx";
import { transposeLabel } from "./CifraCell.utils.ts";
import { buildAssistantTool } from "../AssistantPanel/assistantTool.ts";
import { runTextTransform } from "../../utils/notationAssistant/notationAssistant.ts";

// Transpose + auto-scroll controls, shared by the performance (rendered) and editor views —
// auto-scroll belongs in both, since you may set it up while editing too.
//
// Pure function of its args: `scrollTools` is the already-built output of buildScrollTools, passed
// in by the cell, so this builder never depends on the auto-scroll hook.
export function buildCifraTools({
  t,
  transpose,
  setTranspose,
  scrollTools,
  sourceNow,
  applySource,
}: {
  t: (key: string, vars?: Record<string, unknown>) => string;
  transpose: number;
  setTranspose: (n: number) => void;
  scrollTools: Tool[];
  sourceNow: () => string;
  applySource: (next: { source: string }) => void;
}): Tool[] {
  return [
    {
      kind: "spinner",
      id: "transpose",
      label: t("cifra.transpose"),
      display: transposeLabel(transpose),
      onPrev: () => setTranspose(transpose - 1),
      onNext: () => setTranspose(transpose + 1),
      prevDisabled: transpose <= -11,
      nextDisabled: transpose >= 11,
    },
    ...(transpose !== 0
      ? [
          {
            kind: "action" as const,
            id: "reset",
            icon: ArrowUUpLeft,
            label: t("cifra.original"),
            onUse: () => setTranspose(0),
          },
        ]
      : []),
    { kind: "sep" },
    ...scrollTools,
    { kind: "sep" },
    // On-device assistant — last in the list (an optional power feature, not pushed up front).
    // Edits the chord chart from a plain-language instruction (AssistantPanel).
    buildAssistantTool<{ source: string }>({
      t,
      hintKey: "assistant.hintChords",
      accent: "--s-cinnamon", // matches cellRegistry cifra hue
      snapshot: () => ({ source: sourceNow() }),
      apply: applySource,
      transform: (instruction, onProgress, tier) =>
        runTextTransform("chords", instruction, sourceNow(), onProgress, tier).then((source) => ({
          source,
        })),
    }),
  ];
}
