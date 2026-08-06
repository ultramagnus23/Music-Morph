# HANDSHAKE

Gesture-controlled live music mangler. Full spec: see the build prompt this
scaffold was generated from (§0-§12 cover the constraints, architecture,
gesture system, audio engine, latency budget, smart mixing, UI, failure
modes, build order, and legal notes — re-read §9 before picking up work,
it dictates the order below).

## What's here

This is a scaffold, not a finished app — see inline `TODO` comments for
what each piece still needs. Layout:

- `electron/` — main process: window, IPC handlers, SQLite (`db.ts`), Python
  sidecar bridge (`analyzerBridge.ts`). Renderer never touches Node directly.
- `src/vision/` — webcam -> MediaPipe -> One-Euro filter -> posture
  classifier -> per-hand state machine -> control bus. `handTracker.ts` is
  the Phase 1 "prove the loop" wiring point.
- `src/audio/` — Web Audio graph: `deck.ts` (fixed effect chain, §4.2),
  `effects/*` (one file per effect), `audioEngine.ts` (two decks ->
  crossfader -> master bus). `beatRepeat.ts` and `reverseBuffer.ts` are
  stubs — they need buffer-level capture, not just streaming nodes.
- `src/library/` — SQLite client, offline-analysis client, next-track
  selector (`selector.ts`, §6.2 scoring), Spotify OAuth/API, ISRC/fuzzy
  matcher for playlist import.
- `sidecar/` — Python offline analyzer (`analyze.py`), spawned per-track by
  the main process. Requires Essentia + pyloudnorm.
- `src/ui/` — skeleton overlay, wrist-anchored HUD, waveform strip,
  onboarding state machine.

## Setup

```bash
npm install
npm run sidecar:install
```

`npm run sidecar:install` requires a Python environment with Essentia
available — it doesn't ship prebuilt wheels for every platform, see
Essentia's install docs if `pip install` fails.

## Running

```bash
npm run electron:dev
```

Starts Vite for the renderer and launches Electron pointed at it.

## Known gaps (see TODOs in-file for detail)

- No time-stretch yet (`deck.ts` — needs a Rubber Band AudioWorklet).
- `beatRepeat.ts` / `reverseBuffer.ts` are passthrough stubs.
- Spotify OAuth PKCE flow (`spotify.ts`) has no loopback-server redirect
  catcher yet — `CLIENT_ID` is also unset.
- No onboarding UI (`ui/onboarding.ts` is state-machine-only).
- Master limiter is a `DynamicsCompressorNode` approximation, not a true
  lookahead brickwall limiter.

## Build order

Follow §9 of the spec, not the file layout above: Phase 1 is proving
gesture-to-ear latency feels good with one control (pinch) and one effect
(filter cutoff) on one file, *before* building anything else. Everything in
this scaffold exists so that spike has somewhere to live, not because it
should all be finished first.
