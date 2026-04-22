"use client";

import type { VocalPreference } from "./models";
import { Chip, Field, fieldStyles, SectionLabel } from "./primitives";

const VIBE_SUGGESTIONS = [
  "uplifting",
  "cinematic",
  "dreamy",
  "tense",
  "playful",
  "reflective",
  "euphoric",
  "gritty",
  "warm"
];

export function DirectionSection({
  freeText,
  vibe,
  exclusions,
  vocal,
  onFreeText,
  onVibe,
  onExclusions,
  onVocal
}: {
  freeText: string;
  vibe: string[];
  exclusions: string;
  vocal: VocalPreference;
  onFreeText: (v: string) => void;
  onVibe: (v: string[]) => void;
  onExclusions: (v: string) => void;
  onVocal: (v: VocalPreference) => void;
}) {
  const toggle = (t: string) => {
    onVibe(vibe.includes(t) ? vibe.filter((x) => x !== t) : [...vibe, t]);
  };

  return (
    <section className="space-y-6">
      <SectionLabel number="02" title="Direction" trailing={<span className="text-[12px] text-ink-4">Optional</span>} />

      <Field label="Free-form brief" hint={`${freeText.length}/500`}>
        <textarea
          maxLength={500}
          value={freeText}
          onChange={(e) => onFreeText(e.target.value)}
          placeholder="e.g. hopeful indie-electronic, instrumental, no dark drops"
          className={`${fieldStyles} h-20 resize-none`}
        />
      </Field>

      <div>
        <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.12em] text-ink-3">
          Mood tags
        </p>
        <div className="flex flex-wrap gap-1.5">
          {VIBE_SUGGESTIONS.map((tag) => (
            <Chip key={tag} active={vibe.includes(tag)} onClick={() => toggle(tag)}>
              {tag}
            </Chip>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Avoid">
          <input
            value={exclusions}
            onChange={(e) => onExclusions(e.target.value)}
            placeholder="sad, abrasive, lofi"
            className={fieldStyles}
          />
        </Field>

        <div>
          <p className="mb-1.5 text-[11px] font-medium uppercase tracking-[0.12em] text-ink-3">
            Vocals
          </p>
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                ["instrumental_only", "Instrumental"],
                ["vocals_allowed", "Allowed"],
                ["vocals_preferred", "Preferred"]
              ] as const
            ).map(([v, label]) => (
              <Chip key={v} active={vocal === v} onClick={() => onVocal(v)}>
                {label}
              </Chip>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
