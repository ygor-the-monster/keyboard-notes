import { ArrowUUpLeftIcon as ArrowUUpLeft } from "@phosphor-icons/react";
import type { Tool } from "../Toolbar/Toolbar.tsx";
import { transposeLabel } from "./CifraCell.utils.ts";

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
}: {
  t: (key: string, vars?: Record<string, unknown>) => string;
  transpose: number;
  setTranspose: (n: number) => void;
  scrollTools: Tool[];
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
  ];
}
