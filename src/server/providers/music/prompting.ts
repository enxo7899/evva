import type { Direction } from "@/domain/contracts";

/**
 * Each variation pairs a prompt suffix (guides the model) with a generic
 * title fallback (shown in the Candidates list when the user provided no
 * direction). When the user *does* provide direction, we build titles
 * from their own words so the UI reflects their intent instead of always
 * surfacing the same six fallback names.
 */
const VARIATIONS = [
  {
    key: "warm",
    suffix: "warm texture, soft dynamics, organic feel, gentle low-end, intimate mix",
    title: "Warm Fold"
  },
  {
    key: "pulse",
    suffix: "energetic, tight rhythm, propulsive percussion, modern drum programming",
    title: "Bright Pulse"
  },
  {
    key: "wide",
    suffix: "cinematic, wide stereo, lush atmosphere, sweeping strings, trailer-ready",
    title: "Wide Horizon"
  },
  {
    key: "lofi",
    suffix: "lo-fi, minimal arrangement, tape-warm textures, dusty drums, hiss",
    title: "Paper Tape"
  },
  {
    key: "lift",
    suffix: "hopeful, uplifting, upward harmonic motion, bright piano, airy synth pads",
    title: "Clear Sky"
  },
  {
    key: "drift",
    suffix: "dreamy, modulated pads, soft reverb tail, slow-evolving textures",
    title: "Soft Drift"
  },
  {
    key: "drive",
    suffix: "confident, driving rhythm section, analog bass, percussive top layer",
    title: "Open Road"
  },
  {
    key: "ember",
    suffix: "moody, slow-burn, low strings, subtle tension, patient arrangement",
    title: "Ember"
  }
];

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "at",
  "be",
  "by",
  "for",
  "from",
  "in",
  "is",
  "it",
  "like",
  "of",
  "on",
  "or",
  "some",
  "that",
  "the",
  "this",
  "to",
  "very",
  "with"
]);

/**
 * Turns a user's optional Direction into a short base prompt, then expands
 * it into N distinct-but-coherent variations so candidates feel like
 * alternates rather than duplicates. Titles are personalised when the
 * user gave direction, so the Candidates list doesn't look identical
 * across runs.
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

  const baseText =
    base.length > 0 ? base.join(", ") : "cinematic score for a short video";

  const count = Math.min(8, Math.max(1, candidateCount));

  // Pick variations deterministically-but-distinctly per run, seeded on
  // the direction so repeat runs with the same direction feel consistent
  // yet each *candidate within a run* is a different angle.
  const seed = hashString(baseText);
  const offset = seed % VARIATIONS.length;
  const chosen = Array.from({ length: count }, (_, i) => VARIATIONS[(offset + i) % VARIATIONS.length]);

  const titleSeeds = buildTitleSeeds(direction);
  const prompts: string[] = [];
  const titles: string[] = [];

  for (let i = 0; i < count; i++) {
    const v = chosen[i];
    prompts.push(`${baseText}, ${v.suffix}`);
    titles.push(composeTitle(titleSeeds, v, i));
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

// ---- internals ----

/**
 * Produce up to a few short, titlecase words drawn from the user's own
 * freeText + vibe tags. These become the personalised halves of candidate
 * titles, so "moody synthwave for a cold desert drive" yields titles like
 * "Moody Ember" or "Desert Drift" instead of the generic fallbacks.
 */
function buildTitleSeeds(direction: Direction): string[] {
  const raw: string[] = [];
  if (direction.freeText) raw.push(direction.freeText);
  if (direction.desiredVibe) raw.push(...direction.desiredVibe);

  const seen = new Set<string>();
  const out: string[] = [];

  for (const chunk of raw) {
    const words = chunk
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, " ")
      .split(/\s+/)
      .map((w) => w.trim())
      .filter((w) => w.length >= 4 && w.length <= 14 && !STOP_WORDS.has(w));
    for (const w of words) {
      if (seen.has(w)) continue;
      seen.add(w);
      out.push(titleCase(w));
      if (out.length >= 6) return out;
    }
  }
  return out;
}

function composeTitle(
  titleSeeds: string[],
  variation: (typeof VARIATIONS)[number],
  index: number
): string {
  if (titleSeeds.length === 0) {
    return variation.title;
  }
  // Alternate halves so N candidates read as distinct phrasings of the
  // user's own direction paired with the variation mood.
  const seed = titleSeeds[index % titleSeeds.length];
  const half = variation.title.split(" ")[0];
  return index % 2 === 0 ? `${seed} ${half}` : `${half} ${seed}`;
}

function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0;
  }
  return h;
}
