// Branded ID types kept small for a single-session MVP. Expand later when
// multi-user persistence is introduced.
export type VideoAssetId = `vid_${string}`;
export type CompositionId = `cmp_${string}`;
export type CandidateId = `gsc_${string}`;
export type RenderJobId = `rnd_${string}`;
