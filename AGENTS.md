# Evva Engineering Guide

This file governs architecture and implementation behavior for the Evva repository.

## Product intent
Evva is an AI-assisted short-form video soundtrack generation and audio-mixing app.

The core user flow is:
1. Upload short video
2. Analyze video automatically
3. Optionally provide intent/preferences
4. Generate original soundtrack candidates
5. Select a generated soundtrack or regenerate variations
6. Render mixed output (generated music + original audio balance)
7. Download exported video

## Non-negotiable product rules
- Video analysis must work without user text input.
- User intent is optional, but if present it strongly influences generation.
- Music generation and export are separate subsystems.
- Export must produce a real downloadable video, not metadata only.
- Original audio should not be deleted by default.

## Architecture constraints
- API-first contracts usable by web and future React Native clients.
- Domain logic is framework-agnostic and lives outside UI.
- Provider abstraction for video analysis, generated music, and rendering.
- Generation outputs are frontend-agnostic DTOs.
- No provider-specific behavior in core domain modules.

## Code organization rules
- TypeScript for app and server modules.
- Keep route handlers thin: validate, call service, map response.
- No generation or ranking logic in React components.
- No rendering/mixing logic in route handlers.
- Persistence access goes through repository interfaces.
- Use explicit types for API payloads and job state transitions.

## Media processing rules
- Keep render jobs asynchronous and stateful (`queued`, `processing`, `completed`, `failed`).
- Maintain mix presets and explicit volume controls in the render contract.
- Preserve room for future fade/ducking/voice-friendly mixing controls.

## MVP implementation policy
- Prefer real architecture with selective mocking over fake monoliths.
- Allowed temporary mocks:
  - generated music provider internals
  - advanced vision/audio analysis internals
- Not allowed to fake:
  - API boundaries
  - generation job/request/result object shape
  - render job flow and downloadable output contract

## Done criteria
Feature work is done only when:
- Type-safe contracts are in place
- Errors and validation paths are handled
- End-to-end flow works for the scoped feature
- Limitations/risks are documented
- Setup docs are updated

## Workflow
- Architecture/schema/multi-file work: propose structure first.
- Major features: produce a plan before coding.
- Bugs: identify root cause before fixing.
- Before marking complete: state what changed, what was verified, and what remains limited.
