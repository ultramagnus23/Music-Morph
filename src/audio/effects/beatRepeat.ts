// Right FIST: beat-repeat/stutter. X = division (1/4..1/32, stepped), Y =
// pitch offset 0..+12st, pinch = gate depth.
//
// Unlike the other effects, this can't be a pure streaming node — it needs
// to capture a rolling window of the deck's recent audio and re-trigger
// playback from an anchor point on the beat grid, so it lives at the deck
// level rather than as an isolated node graph.
//
// TODO(Phase 3): implement via a ring-buffer AudioWorklet that continuously
// records its input and, when `active` flips true, loops the last
// `division` worth of samples (read from the ring buffer, resampled per
// `pitchOffset`) until `active` flips false. Trigger point must be
// quantized to the beat clock (§3.8) — do not start the loop the instant
// the gesture fires.

import type { Effect, EffectParams } from "./types";

export function createBeatRepeatEffect(ctx: BaseAudioContext): Effect {
  const passthrough = ctx.createGain();

  return {
    name: "beatRepeat",
    input: passthrough,
    output: passthrough,
    setParams(_params: EffectParams, _audioCtx: BaseAudioContext) {
      // no-op until the ring-buffer worklet lands
    },
    dispose() {
      passthrough.disconnect();
    },
  };
}
