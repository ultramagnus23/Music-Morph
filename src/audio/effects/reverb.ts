// Left PEACE: reverb. X = room size (selects/regenerates the IR), Y =
// pre-delay 0-120ms, pinch = wet capped at 70% per spec.
//
// TODO: swap the procedurally generated impulse response below for a small
// library of real IRs (§2.1 "room size / IR select" implies a curated set,
// not just a decay-time knob). Procedural noise-decay IRs are a reasonable
// placeholder and keep this effect dependency-free for now.

import { createWetDryMix, type Effect, type EffectParams } from "./types";
import { smoothSet } from "../paramSmoothing";

const MAX_WET = 0.7;
const MAX_PREDELAY_SECONDS = 0.12;
const MIN_DECAY_SECONDS = 0.6;
const MAX_DECAY_SECONDS = 4.5;
const ROOM_SIZE_BUCKETS = 8;

function generateImpulseResponse(ctx: BaseAudioContext, decaySeconds: number): AudioBuffer {
  const rate = ctx.sampleRate;
  const length = Math.max(1, Math.floor(rate * decaySeconds));
  const buffer = ctx.createBuffer(2, length, rate);
  for (let channel = 0; channel < 2; channel++) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < length; i++) {
      const decay = Math.pow(1 - i / length, 2.5);
      data[i] = (Math.random() * 2 - 1) * decay;
    }
  }
  return buffer;
}

export function createReverbEffect(ctx: BaseAudioContext): Effect {
  const preDelay = ctx.createDelay(MAX_PREDELAY_SECONDS + 0.01);
  const convolver = ctx.createConvolver();
  convolver.normalize = true;
  convolver.buffer = generateImpulseResponse(ctx, MIN_DECAY_SECONDS);

  preDelay.connect(convolver);

  const mix = createWetDryMix(ctx, preDelay, convolver);

  let lastBucket = -1;

  return {
    name: "reverb",
    input: mix.input,
    output: mix.output,
    setParams(params: EffectParams, audioCtx: BaseAudioContext) {
      const bucket = Math.min(ROOM_SIZE_BUCKETS - 1, Math.floor(params.x * ROOM_SIZE_BUCKETS));
      if (bucket !== lastBucket) {
        lastBucket = bucket;
        const decay = MIN_DECAY_SECONDS + (bucket / (ROOM_SIZE_BUCKETS - 1)) * (MAX_DECAY_SECONDS - MIN_DECAY_SECONDS);
        convolver.buffer = generateImpulseResponse(audioCtx, decay);
      }

      smoothSet(preDelay.delayTime, params.y * MAX_PREDELAY_SECONDS, audioCtx);
      smoothSet(mix.wetGain.gain, params.wet * MAX_WET, audioCtx);
      smoothSet(mix.dryGain.gain, 1 - params.wet * MAX_WET, audioCtx);
    },
    dispose() {
      preDelay.disconnect();
      convolver.disconnect();
      mix.input.disconnect();
      mix.output.disconnect();
    },
  };
}
