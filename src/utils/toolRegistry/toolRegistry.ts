// Registry of utility tools that can open as a full-page screen (hash route). Mirrors cellRegistry:
// one source of truth for screen ids, their display label, and accent colour. Tools are added here
// as they gain a screen layout — start with the metronome, expand from there.
export interface ToolView {
  /** Screen id — matches the URL hash (`#metronome`) and the dock's expand target. */
  id: string;
  /** i18n key for the tool's display name (shown in the topbar while its screen is open). */
  labelKey: string;
  /** Accent token base, e.g. "--s-magenta". */
  accent: string;
}

export const toolRegistry: Record<string, ToolView> = {
  metronome: { id: "metronome", labelKey: "metronome.name", accent: "--s-magenta" },
  tuner: { id: "tuner", labelKey: "tuner.name", accent: "--s-cinnamon-strong" },
  scratchpad: { id: "scratchpad", labelKey: "scratch.name", accent: "--s-blue" },
};
