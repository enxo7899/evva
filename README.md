# Evva

AI-assisted soundtrack generation and audio-mixing for short-form video.

Drop a reel → get original music generated for it → audition the mix in the
browser → export a final MP4.

This repository is the **first real MVP**. It is deliberately simple:

- **No database.** Single-session, in-memory state. Files live on the local
  filesystem (`public/uploads/`, `public/generated/`, `public/renders/`).
- **Real music provider.** [ElevenLabs Music](https://elevenlabs.io/music)
  is the primary path (Replicate `meta/musicgen` is available as an
  alternate). A clearly-labeled mock fallback exists for local runs without
  an API key.
- **Real video export.** ffmpeg bakes the selected track + your mix levels
  into an MP4 **at the source reel's own aspect ratio** — no letterbox, no
  pillarbox, no black padding. A clearly-labeled preview-copy fallback
  exists for environments without ffmpeg.
- **Real upload, real job lifecycle, real downloadable artifact.**

## Stack

- Next.js 15 App Router, React 19
- TypeScript (strict)
- Tailwind CSS
- Zod (API validation)
- Node `child_process` for ffmpeg / ffprobe

No database, no auth, no queue service, no cloud storage. Those are future
concerns if the product earns them.

## Product scope (intentional)

1. Upload a short video.
2. Optionally provide creative direction (free text, mood tags, exclusions,
   vocal preference).
3. Generate original soundtrack candidates.
4. Choose one.
5. Mix it against the original audio with real level controls.
6. Export and download the final video.

Explicitly **not** in scope for now: accounts, project history, saved
generations/videos, favorites, billing, analytics, multi-user state,
resumable background tasks. The architecture deliberately avoids those to
stay focused.

## Architecture

```
app/api/v1
  POST /videos/upload
  POST /compositions
  GET  /compositions/[id]
  POST /compositions/[id]/select
  POST /renders
  GET  /renders/[id]
  GET  /config                    ← honest provider disclosure

src/contracts/api.ts              ← external DTOs (mobile-reusable)
src/domain/contracts.ts           ← internal domain types

src/server
  /providers
    /music
      interface.ts
      replicate.ts                ← real music provider (Replicate)
      mock.ts                     ← labeled local fallback
      prompting.ts                ← direction → prompt variations
    /media
      interface.ts
      ffmpeg.ts                   ← real render + mix (ffmpeg amix)
      preview-copy.ts             ← labeled fallback (copies source)
    registry.ts                   ← single source of truth per process
  /services
    compositions.ts               ← upload → analyze → compose → select
    renders.ts                    ← render + poll + output URL
  /runtime
    session-store.ts              ← in-memory Map with TTL
    analysis.ts                   ← honest ffprobe-backed analysis
    ids.ts

components/studio/*               ← UI (upload-first light editorial)
features/generation/api.ts        ← typed client for /api/v1
hooks/use-job-polling.ts          ← client poll loop
```

One composition = one user "compose soundtrack" run. It owns analysis,
direction, candidates, and the selected candidate. No separate
IntentProfile / GenerationRequest / Selection / Feedback records in this
MVP — each of those was collapsed into `CompositionJob`.

## Environment variables

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

| Variable                      | Default            | Notes |
|-------------------------------|--------------------|-------|
| `GENERATED_MUSIC_PROVIDER`    | `elevenlabs`       | `elevenlabs`, `replicate`, or `mock`. Falls back to `mock` if the selected real provider's key is missing. |
| `ELEVENLABS_API_KEY`          | —                  | Required when provider is `elevenlabs`. Create at https://elevenlabs.io/app/settings/api-keys. Account must have Music API access. |
| `ELEVENLABS_MUSIC_MODEL`      | —                  | Optional model override. Leave blank for ElevenLabs' default. |
| `REPLICATE_API_TOKEN`         | —                  | Required when provider is `replicate`. Create at https://replicate.com/account/api-tokens. |
| `REPLICATE_MUSIC_MODEL`       | `meta/musicgen`    | Replicate model slug. |
| `MEDIA_RENDERER_PROVIDER`     | `ffmpeg`           | Set to `preview-copy` if ffmpeg isn't installed. |
| `FFMPEG_PATH`                 | `ffmpeg`           | Absolute path if ffmpeg isn't on `PATH`. |
| `FFPROBE_PATH`                | `ffprobe`          | Used by the honest analyzer. Optional. |

The Studio's header surfaces the active modes so you're never misled about
what the current run is actually doing.

## Local setup

```bash
git clone https://github.com/enxo7899/evva.git
cd evva
npm install
cp .env.example .env.local

# Recommended: real music + real render.
# Edit .env.local and set:
#   GENERATED_MUSIC_PROVIDER=elevenlabs
#   ELEVENLABS_API_KEY=<your key>
#   MEDIA_RENDERER_PROVIDER=ffmpeg

# Install ffmpeg + ffprobe for the real render path:
brew install ffmpeg           # macOS
# or: sudo apt install ffmpeg # Debian/Ubuntu

npm run dev
open http://localhost:3000
```

### Getting an ElevenLabs key

1. Create an account at https://elevenlabs.io.
2. Subscribe to a plan that includes Music API access (the free tier does
   not include Music at the time of writing — Creator and above do).
3. Visit https://elevenlabs.io/app/settings/api-keys and click **Create
   API Key**. Scope it to your workspace, copy the value.
4. Paste it into `.env.local` as `ELEVENLABS_API_KEY=...`.
5. Restart `npm run dev`. The Studio header will change from
   "Preview music" to "ElevenLabs" once the key is detected.

### No-key local mode

If you want to run everything without an API key:

```
GENERATED_MUSIC_PROVIDER=mock
MEDIA_RENDERER_PROVIDER=preview-copy
```

The UI clearly labels this as preview mode. Candidates will be seeded
sine-wave sketches and the exported file will be a copy of the source
video (the in-browser mix is still audible live).

## Local test steps

1. Open the app. Drop any MP4/MOV/WEBM (under 200MB).
2. Uploads happen automatically. Optionally add direction on the right side.
3. Click **Compose**. In Replicate mode, watch the polling loop progress
   while `meta/musicgen` renders each candidate. Audio files land in
   `public/generated/`.
4. Click **Use this track** on a candidate. Hit play in the Stage — video
   plays with the candidate synced on top. Drag the **Music** and
   **Original audio** sliders; pick a preset chip. This is the real mix
   audition in the browser.
5. Click **Render final mix** (or **Export preview** in fallback mode).
   In ffmpeg mode, the selected track + your levels are baked into
   `public/renders/<renderJobId>.mp4`. Click **Download**.

Verification:

```bash
npm run typecheck
npm run lint
npm run build
```

## API shapes (external)

All client-server traffic uses the typed DTOs in `src/contracts/api.ts`:

- `VideoUploadResponse`
- `CreateCompositionRequest`, `CompositionResponse`
- `SelectCandidateRequest`
- `CreateRenderRequest`, `RenderResponse`
- `ConfigResponse`

The poll pattern: `POST /compositions` returns `{ composition }` with
`status: "queued"`. The client polls `GET /compositions/[id]` until
`status: "completed"`, at which point `composition.candidates[]` is
populated. Same pattern for renders.

## What's real right now

- Real local upload to `public/uploads/`.
- Real ffprobe-backed metadata extraction (duration + aspect ratio).
- Real Replicate music generation with polled async status and downloaded
  audio artifacts under `public/generated/`.
- Real client-side mix audition (video + synced audio with live volumes).
- Real ffmpeg render baking mix into a downloadable MP4 under
  `public/renders/`.
- Honest provider disclosure via `GET /api/v1/config` surfaced in the UI.

## What is explicitly fallback-only

- The mock music provider (seeded sine-wave sketches, for no-key runs).
- The preview-copy renderer (copies source video, for no-ffmpeg runs).

Both are labeled in the UI. They exist so developers can run the flow
end-to-end without external dependencies; they are never the main path.

## Where this stops, deliberately

- No persistence across restarts.
- No accounts or history.
- No webhook-driven background workers (the pollable API is enough for a
  single session).
- No cloud storage — files live on the server's filesystem under `public/`.

These are all easy to add behind existing seams when the product earns it.
The service layer is already provider-agnostic; the repository-style
`session-store.ts` can be swapped for a real store without API changes.

## Notes for a future mobile client

`src/contracts/api.ts` is the mobile contract. All endpoints return those
DTOs. A React Native / Expo client can consume `/api/v1/*` identically and
re-use the poll pattern. No UI-only logic bleeds into server routes.
