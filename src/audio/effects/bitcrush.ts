// Left HORNS: bitcrush + downsample. X = bit depth 16->3, Y = sample rate
// 48k->2k (expressed as a reduction factor), pinch = wet.
//
// Requires the AudioWorklet module (worklets/bitcrusher-processor.js) to be
// registered on the AudioContext first — see AudioEngine.init().

import { createWetDryMix, type Effect, type EffectParams } from "./types";
import { linRange, smoothSet } from "../paramSmoothing";

const BIT_DEPTH_MAX = 16;
const BIT_DEPTH_MIN = 3;
const SR_REDUCTION_MIN = 1; // ~48kHz effective
const SR_REDUCTION_MAX = 24; // ~2kHz effective

export function createBitcrushEffect(ctx: AudioContext): Effect {
  const worklet = new AudioWorkletNode(ctx, "bitcrusher-processor", {
    numberOfInputs: 1,
    numberOfOutputs: 1,
    outputChannelCount: [2],
  });

  const mix = createWetDryMix(ctx, worklet, worklet);

  const bitDepthParam = worklet.parameters.get("bitDepth")!;
  const srReductionParam = worklet.parameters.get("sampleRateReduction")!;

  return {
    name: "bitcrush",
    input: mix.input,
    output: mix.output,
    setParams(params: EffectParams, audioCtx: BaseAudioContext) {
      const bitDepth = linRange(params.x, BIT_DEPTH_MAX, BIT_DEPTH_MIN);
      const srReduction = linRange(params.y, SR_REDUCTION_MIN, SR_REDUCTION_MAX);
      smoothSet(bitDepthParam, bitDepth, audioCtx);
      smoothSet(srReductionParam, srReduction, audioCtx);
      smoothSet(mix.wetGain.gain, params.wet, audioCtx);
      smoothSet(mix.dryGain.gain, 1 - params.wet, audioCtx);
    },
    dispose() {
      worklet.disconnect();
      mix.input.disconnect();
      mix.output.disconnect();
    },
  };
}
