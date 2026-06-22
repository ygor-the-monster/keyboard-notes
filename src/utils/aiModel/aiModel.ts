// The on-device model tiers, shared by every AI feature (the tutor chat and the per-cell editing
// assistant). One preference (MODEL_TIER_PREF) picks the tier; both features resolve their model id
// + quantization from here, so a user's choice applies everywhere and the model is cached once per
// id (see loadGenerator).
//
// Tier choices (benchmarks + practicality for a browser/WebGPU PWA, June 2026):
//   fast  — LFM2.5-1.2B: purpose-built for on-device, snappy, fits almost any WebGPU device.
//   smart — Llama-3.2-3B-Instruct: a top ~3B instruct model and CONFIRMED anonymously fetchable as
//           an onnx-community ONNX build. Qwen2.5-3B-Instruct benchmarks marginally higher (MMLU
//           ~65.6 vs ~63) — swap the id below to onnx-community/Qwen2.5-3B-Instruct if/when that
//           ONNX repo is confirmed reachable.
//   ultra — Phi-3.5-mini-instruct (3.8B): the strongest reasoning model that actually runs in a
//           browser. A true 7-8B has no ungated, WebGPU-ready ONNX build (Qwen2.5-7B isn't on
//           onnx-community; Llama-3.1-8B is gated → 401 in-browser) and ~5 GB is impractical anyway.
//           This is the onnx-community "-onnx-web" build used by the official Transformers.js Phi-3.5
//           WebGPU demo (MIT, ungated), so it's verified to load; it outscores the 3B on reasoning.
import type { Dtype } from "../notationAssistant/notationAssistant.ts";

export type ModelTier = "fast" | "smart" | "ultra";

export interface TierSpec {
  tier: ModelTier;
  /** Hugging Face repo id — an ONNX build compatible with Transformers.js + WebGPU. */
  id: string;
  dtype: Dtype;
  /** Approximate first-use download, shown in the consent prompt and the selector caption. */
  approxSize: string;
}

export const MODEL_TIERS: Record<ModelTier, TierSpec> = {
  fast: { tier: "fast", id: "LiquidAI/LFM2.5-1.2B-Instruct-ONNX", dtype: "q4", approxSize: "1 GB" },
  smart: { tier: "smart", id: "onnx-community/Llama-3.2-3B-Instruct-ONNX", dtype: "q4", approxSize: "2 GB" },
  ultra: { tier: "ultra", id: "onnx-community/Phi-3.5-mini-instruct-onnx-web", dtype: "q4f16", approxSize: "2.5 GB" },
};

export const DEFAULT_TIER: ModelTier = "fast";
export const TIER_ORDER: readonly ModelTier[] = ["fast", "smart", "ultra"];

// The localStorage pref key shared by every AI surface.
export const MODEL_TIER_PREF = "ai.modelTier";

// Resolve a (possibly stale or undefined) tier value to a spec, always falling back to fast.
export function resolveTier(tier: ModelTier | undefined): TierSpec {
  return (tier && MODEL_TIERS[tier]) || MODEL_TIERS[DEFAULT_TIER];
}
