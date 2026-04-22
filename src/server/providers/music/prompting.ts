import type { Direction } from "@/domain/contracts";

const VARIATIONS = [
  { suffix: "warm texture, soft dynamics, organic feel", title: "Warm Fold" },
  { suffix: "energetic, tight rhythm, propulsive percussion", title: "Bright Pulse" },
  { suffix: "cinematic, wide stereo, lush atmosphere", title: "Wide Horizon" },
  { suffix: "lo-fi, minimal arrangement, tape-warm textures", title: "Paper Tape" },
  { suffix: "hopeful, uplifting, upward harmonic motion", title: "Clear Sky" },
  { suffix: "dreamy, modulated pads, soft reverb tail", title: "Soft Drift" }
];

/**
 * Turns a user's optional Direction into a short base prompt, then expands
 * it into N distinct-but-coherent variations so candidates feel like
 * alternates rather than duplicates.
 */
export function buildPrompts(direction: Direction, candidateCount: number): {
  prompts: string[];
  titles: string[];
} {
  const base: string[] = [];

  if (direction.freeText?.trim()) {
    base.push(direction.freeText.trim());
  }
  if (direction.desiredVibe?.length) {
    base.push(direction.desiredVibe.join(", "));
  }
  if (direction.exclusions?.length) {
    base.push(`avoid ${direction.exclusions.join(", ")}`);
  }
  if (direction.vocalPreference === "instrumental_only") {
    base.push("instrumental only, no vocals");
  } else if (direction.vocalPreference === "vocals_preferred") {
    base.push("soft vocals welcome");
  }

  const baseText = base.length > 0 ? base.join(", ") : "cinematic score for a short video";

  const count = Math.min(6, Math.max(1, candidateCount));
  const prompts: string[] = [];
  const titles: string[] = [];

  for (let i = 0; i < count; i++) {
    const v = VARIATIONS[i % VARIATIONS.length];
    prompts.push(`${baseText}, ${v.suffix}`);
    titles.push(v.title);
  }

  return { prompts, titles };
}

export function deriveTags(direction: Direction, variantSuffix?: string): string[] {
  const tags = new Set<string>();
  direction.desiredVibe?.forEach((t) => tags.add(t.toLowerCase()));
  if (variantSuffix) {
    variantSuffix.split(",").forEach((t) => {
      const clean = t.trim().toLowerCase();
      if (clean && clean.length < 22) tags.add(clean);
    });
  }
  if (direction.vocalPreference === "instrumental_only") tags.add("instrumental");
  return Array.from(tags).slice(0, 5);
}
