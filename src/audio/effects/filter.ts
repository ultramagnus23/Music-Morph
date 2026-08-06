// Left FIST (low-pass) / left POINT (high-pass), §3.7. X = cutoff (log
// space), Y = resonance Q, pinch = wet.

import { createWetDryMix, type Effect, type EffectParams } from "./types";
import { logRange, linRange, smoothSet } from "../paramSmoothing";

const CUTOFF_MIN = 80;
const CUTOFF_MAX = 20000;
const Q_MIN = 0.7;
const Q_MAX = 14;

export function createFilterEffect(ctx: BaseAudioContext, type: "lowpass" | "highpass"): Effect {
  const biquad = ctx.createBiquadFilter();
  biquad.type = type;
  biquad.frequency.value = type === "lowpass" ? CUTOFF_MAX : CUTOFF_MIN;
  biquad.Q.value = Q_MIN;

  const mix = createWetDryMix(ctx, biquad, biquad);

  return {
    name: type === "lowpass" ? "filter.lowpass" : "filter.highpass",
    input: mix.input,
    output: mix.output,
    setParams(params: EffectParams, audioCtx: BaseAudioContext) {
      const cutoff = logRange(params.x, CUTOFF_MIN, CUTOFF_MAX);
      const q = linRange(params.y, Q_MIN, Q_MAX);
      smoothSet(biquad.frequency, cutoff, audioCtx);
      smoothSet(biquad.Q, q, audioCtx);
      // Reduce makeup gain as Q rises to avoid resonant-peak clipping (§8).
      smoothSet(mix.wetGain.gain, params.wet * (1 - 0.15 * (q / Q_MAX)), audioCtx);
      smoothSet(mix.dryGain.gain, 1 - params.wet, audioCtx);
    },
    dispose() {
      biquad.disconnect();
      mix.input.disconnect();
      mix.output.disconnect();
    },
  };
}
