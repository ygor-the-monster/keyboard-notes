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
//   ultra — Qwen2.5-7B-Instruct: benchmark leader of the ~7-8B class (MMLU ~74, ahead of
//           Llama-3.1-8B ~69) AND Apache-2.0 / ungated, so it can download without a token in the
//           browser — unlike the gated Llama-3.1-8B. Verify this repo id loads on first use; it is a
//           heavy (~5 GB) opt-in download that only runs on capable GPUs.
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
  ultra: { tier: "ultra", id: "onnx-community/Qwen2.5-7B-Instruct", dtype: "q4", approxSize: "5 GB" },
};

export const DEFAULT_TIER: ModelTier = "fast";
export const TIER_ORDER: readonly ModelTier[] = ["fast", "smart", "ultra"];

// The localStorage pref key shared by every AI surface.
export const MODEL_TIER_PREF = "ai.modelTier";

// Resolve a (possibly stale or undefined) tier value to a spec, always falling back to fast.
export function resolveTier(tier: ModelTier | undefined): TierSpec {
  return (tier && MODEL_TIERS[tier]) || MODEL_TIERS[DEFAULT_TIER];
}
