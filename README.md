# Evva

AI-assisted soundtrack generation and audio-mixing for short-form video.

Drop a reel → get original music generated for it → audition the mix in the
browser → export a final MP4.

This repository is the **first real MVP**. It is deliberately simple:

- **Session state in KV.** [Vercel KV](https://vercel.com/storage/kv) (or
  any Upstash-compatible Redis) in production; a process-local `Map`
  fallback for local dev. No Postgres, no schema migrations.
- **Media in Blob.** Uploads, generated audio, and rendered MP4s live in
  [Vercel Blob](https://vercel.com/storage/blob) in production. Locally,
  they fall back to `public/uploads/`, `public/generated/`,
  `public/renders/` so `npm run dev` works with no cloud setup.
- **Direct-to-Blob uploads.** On Vercel the browser PUTs reel bytes
  straight to Blob via a short-lived token, bypassing the serverless body
  cap. Locally, multipart uploads go through our own route.
- **Real music provider.** [ElevenLabs Music](https://elevenlabs.io/music)
  is the primary path (Replicate `meta/musicgen` is available as an
  alternate). A clearly-labeled mock fallback exists for local runs without
  an API key.
- **Real video export.** ffmpeg bakes the selected track + your mix levels
  into an MP4 **at the source reel's own aspect ratio** — no letterbox, no
  pillarbox, no black padding. The ffmpeg/ffprobe binaries are bundled via
  `@ffmpeg-installer` / `@ffprobe-installer`, so serverless deploys work
  out of the box.
- **Real upload, real job lifecycle, real downloadable artifact.**

## Stack

- Next.js 15 App Router, React 19
- TypeScript (strict)
- Tailwind CSS
- Zod (API validation)
- `@vercel/blob` for media storage, `@vercel/kv` for session state
- `@ffmpeg-installer/ffmpeg` + `@ffprobe-installer/ffprobe` so serverless
  deploys ship with working binaries; local dev can still use the ffmpeg on
  `PATH` via `FFMPEG_PATH` / `FFPROBE_PATH`

No Postgres, no auth, no queue service. Those are future concerns if the
product earns them.

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
      elevenlabs.ts               ← real music provider (ElevenLabs)
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
    session-store.ts              ← async KV-backed video/comp/render stores
    kv.ts                         ← @vercel/kv wrapper + globalThis fallback
    storage.ts                    ← @vercel/blob wrapper + public/ fallback
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
| `FFMPEG_PATH`                 | —                  | Optional. On Vercel we use the bundled `@ffmpeg-installer` binary. Set this locally only if you don't want to use the one on `PATH`. |
| `FFPROBE_PATH`                | —                  | Same as `FFMPEG_PATH`, for the analyzer. |
| `BLOB_READ_WRITE_TOKEN`       | —                  | Vercel Blob token. Auto-set in Vercel once you add a Blob store. Unset ⇒ media falls back to `public/`. |
| `KV_REST_API_URL` + `KV_REST_API_TOKEN` | —         | Vercel KV / Upstash. Auto-set in Vercel once you add a KV store. Unset ⇒ sessions use an in-process `Map`. |

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

## Deploying to Vercel

1. **Fork or push** this repo to your own GitHub account.
2. **Import** the repo at https://vercel.com/new. Keep the defaults
   (Next.js framework, Node runtime).
3. In the new project's **Storage** tab, create two stores:
   - A **Blob** store → this auto-injects `BLOB_READ_WRITE_TOKEN`.
   - A **KV** store → this auto-injects `KV_REST_API_URL`,
     `KV_REST_API_TOKEN`, `KV_REST_API_READ_ONLY_TOKEN`, `KV_URL`.
4. In **Settings → Environment Variables**, add your music provider key:
   ```
   GENERATED_MUSIC_PROVIDER=elevenlabs
   ELEVENLABS_API_KEY=<your key>
   ```
   Or the Replicate equivalent. Redeploy to pick them up.
5. **Plan requirements.** The `/api/v1/compositions` route has
   `maxDuration = 300` (music generation blocks until all candidates are
   back) and `/api/v1/renders` has `maxDuration = 120` (ffmpeg runs
   synchronously). The Hobby plan caps duration well below these — use
   **Pro or higher** for real deploys. Hobby still works for
   `GENERATED_MUSIC_PROVIDER=mock` + short reels.
6. Hit the deployed URL. The Studio header will show `ElevenLabs` +
   `ffmpeg` once everything is wired up. Uploads will go directly to
   Blob; generated audio and rendered MP4s will be served from Blob's
   CDN.

### What happens behind the scenes

- **Uploads**: the browser asks `/api/v1/videos/upload-token` for a
  short-lived Blob write token, PUTs the file directly to Blob, then
  calls `/api/v1/videos/register` so the server records a
  `VideoAsset` in KV. Locally (no Blob token) it falls back to a
  multipart POST to `/api/v1/videos/upload` that writes to
  `public/uploads/`.
- **Compose**: the music provider runs synchronously inside the POST.
  For ElevenLabs we fire N parallel generations, await all of them,
  upload each track to Blob, and persist results in KV. The client
  polls `GET /compositions/[id]` which just reads KV.
- **Render**: ffmpeg runs synchronously inside the POST. Source video
  and generated audio are fetched to `/tmp`, mixed, the resulting MP4
  is uploaded to Blob, and the KV render record flips to `completed`.

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

- Real upload — direct-to-Blob on Vercel, multipart on localhost.
- Real ffprobe-backed metadata extraction (duration + aspect ratio), using
  the bundled `@ffprobe-installer` binary on serverless.
- Real ElevenLabs (or Replicate) music generation, with audio artifacts
  stored in Blob and indexed in KV.
- Real client-side mix audition (video + synced audio with live volumes).
- Real ffmpeg render baking mix into a downloadable MP4 stored in Blob.
- Honest provider disclosure via `GET /api/v1/config` surfaced in the UI,
  including the active upload mode.

## What is explicitly fallback-only

- The mock music provider (seeded sine-wave sketches, for no-key runs).
- The preview-copy renderer (copies source video, for no-ffmpeg runs).
- The in-process KV/Blob fallbacks (only valid for a single local `npm run
  dev` worker; production needs real stores).

All are labeled in the UI. They exist so developers can run the flow
end-to-end without external dependencies; they are never the main path.

## Where this stops, deliberately

- No accounts or history.
- No webhook-driven background workers — all generation and rendering
  blocks inside the POST and persists results in KV so polls are cheap.
- No custom queue service; the synchronous-in-POST + KV pattern is
  sufficient for single-reel, single-user sessions.

These are all easy to add behind existing seams when the product earns it.
The service layer is already provider-agnostic; the KV-backed
`session-store.ts` can be swapped for Postgres/Prisma without API changes.

## Notes for a future mobile client

`src/contracts/api.ts` is the mobile contract. All endpoints return those
DTOs. A React Native / Expo client can consume `/api/v1/*` identically and
re-use the poll pattern. No UI-only logic bleeds into server routes.
