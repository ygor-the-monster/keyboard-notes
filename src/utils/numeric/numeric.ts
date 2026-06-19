// Small numeric helpers shared across cells and Pull Tabs.

// Restrict a value to the inclusive range [min, max].
export const clamp = (n: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, n));
