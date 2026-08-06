// Right POINT: tempo-synced delay. X selects note division (stepped), Y =
// feedback, pinch = wet.

import { createWetDryMix, type Effect, type EffectParams } from "./types";
import { smoothSet } from "../paramSmoothing";

const DIVISIONS = [0.25, 0.375, 0.5, 0.125] as const; // 1/4, dotted 1/8, 1/8, 1/16 (in beats)
const MAX_FEEDBACK = 0.88;
const MAX_DELAY_SECONDS = 2; // DelayNode buffer ceiling

function stepIndex(x: number, count: number): number {
  return Math.min(count - 1, Math.floor(x * count));
}

export function createDelayEffect(ctx: BaseAudioContext): Effect {
  const delayNode = ctx.createDelay(MAX_DELAY_SECONDS);
  const feedbackGain = ctx.createGain();
  const output = ctx.createGain();

  delayNode.connect(feedbackGain);
  feedbackGain.connect(delayNode);
  delayNode.connect(output);

  const mix = createWetDryMix(ctx, delayNode, output);

  return {
    name: "delay",
    input: mix.input,
    output: mix.output,
    setParams(params: EffectParams, audioCtx: BaseAudioContext) {
      const bpm = params.bpm > 0 ? params.bpm : 120;
      const beatsPerDivision = DIVISIONS[stepIndex(params.x, DIVISIONS.length)];
      const secondsPerBeat = 60 / bpm;
      const delayTime = Math.min(MAX_DELAY_SECONDS, beatsPerDivision * secondsPerBeat);

      smoothSet(delayNode.delayTime, delayTime, audioCtx);
      smoothSet(feedbackGain.gain, params.y * MAX_FEEDBACK, audioCtx);
      smoothSet(mix.wetGain.gain, params.wet, audioCtx);
      smoothSet(mix.dryGain.gain, 1 - params.wet, audioCtx);
    },
    dispose() {
      delayNode.disconnect();
      feedbackGain.disconnect();
      output.disconnect();
      mix.input.disconnect();
      mix.output.disconnect();
    },
  };
}
