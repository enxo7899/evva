import { z } from "zod";

const mixPresetSchema = z.enum([
  "balanced",
  "music-forward",
  "voice-friendly",
  "original-audio-forward"
]);

const vocalPreferenceSchema = z.enum([
  "instrumental_only",
  "vocals_allowed",
  "vocals_preferred"
]);

export const directionSchema = z
  .object({
    freeText: z.string().trim().max(1000).optional(),
    desiredVibe: z.array(z.string().min(1).max(60)).max(12).optional(),
    exclusions: z.array(z.string().min(1).max(60)).max(12).optional(),
    vocalPreference: vocalPreferenceSchema.optional()
  })
  .optional();

export const createCompositionSchema = z.object({
  videoAssetId: z.string().startsWith("vid_"),
  direction: directionSchema,
  candidateCount: z.number().int().min(1).max(6).default(3)
});

export const selectCandidateSchema = z.object({
  candidateId: z.string().startsWith("gsc_")
});

export const createRenderSchema = z.object({
  compositionId: z.string().startsWith("cmp_"),
  mix: z.object({
    preset: mixPresetSchema,
    originalAudioLevel: z.number().min(0).max(1),
    musicLevel: z.number().min(0).max(1),
    fadeInSec: z.number().min(0).max(10).optional(),
    fadeOutSec: z.number().min(0).max(10).optional()
  })
});
