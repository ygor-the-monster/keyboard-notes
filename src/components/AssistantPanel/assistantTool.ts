import { createElement } from "react";
import { SparkleIcon as Sparkle } from "@phosphor-icons/react";
import AssistantPanel from "./AssistantPanel.tsx";
import type { LoadProgress } from "../../utils/notationAssistant/notationAssistant.ts";
import type { ModelTier } from "../../utils/aiModel/aiModel.ts";
import type { Tool } from "../Toolbar/Toolbar.tsx";

// Builds the shared "✨ assistant" input-tool for a text-bearing cell's toolbar. Each cell supplies
// its content shape `T` ({ header, body } | { source }) plus snapshot/apply/transform; the rendered
// AssistantPanel is otherwise identical everywhere. Kept JSX-free (createElement) so tool builders
// stay plain .ts.
export function buildAssistantTool<T>(args: {
  t: (key: string, vars?: Record<string, unknown>) => string;
  /** Per-cell hint i18n key, e.g. "assistant.hint" (score) / "assistant.hintNote" / "assistant.hintChords". */
  hintKey: string;
  /** Owning cell's hue base token (cellRegistry hue.base), e.g. "--s-magenta", so the panel matches it. */
  accent: string;
  snapshot: () => T;
  apply: (next: T) => void;
  transform: (
    instruction: string,
    onProgress: (p: LoadProgress) => void,
    tier: ModelTier,
  ) => Promise<T>;
}): Tool {
  const { t, hintKey, accent, snapshot, apply, transform } = args;
  return {
    kind: "input",
    id: "assistant",
    icon: Sparkle,
    label: t("assistant.toolLabel"),
    render: ({ close }) =>
      createElement(AssistantPanel<T>, { hintKey, accent, snapshot, apply, transform, close }),
  };
}
