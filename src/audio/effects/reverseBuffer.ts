// Right THUMB: reverse buffer. X = buffer length 1/2..2 bars, pinch = full/dry blend.
//
// Same deck-level constraint as beatRepeat.ts: needs a rolling capture of
// recent audio to play backward, not just a forward-streaming node.
//
// TODO(Phase 3): capture the last N bars (N from X, beat-clock-derived) into
// an AudioBuffer, play it via a scheduled reversed AudioBufferSourceNode
// (reverse by writing the channel data backward, since AudioBufferSourceNode
// has no native reverse-playback flag), quantized to the next beat boundary.

import type { Effect, EffectParams } from "./types";

export function createReverseBufferEffect(ctx: BaseAudioContext): Effect {
  const passthrough = ctx.createGain();

  return {
    name: "reverseBuffer",
    input: passthrough,
    output: passthrough,
    setParams(_params: EffectParams, _audioCtx: BaseAudioContext) {
      // no-op until buffer capture lands
    },
    dispose() {
      passthrough.disconnect();
    },
  };
}
