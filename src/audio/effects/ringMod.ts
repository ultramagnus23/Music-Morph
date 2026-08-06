// Right HORNS: ring modulator. X = carrier frequency 20Hz-2.2kHz, Y = LFO
// depth on the carrier, pinch = wet.
//
// Ring modulation = multiplying the signal by a bipolar carrier. Connecting
// an oscillator (range -1..1) directly to a GainNode's gain AudioParam adds
// to that param's value, so with gain.gain held at 0 the effective gain at
// each sample *is* the oscillator's instantaneous value — exactly the
// multiply we want, no worklet required.

import { createWetDryMix, type Effect, type EffectParams } from "./types";
import { logRange, smoothSet } from "../paramSmoothing";

const CARRIER_MIN = 20;
const CARRIER_MAX = 2200;
const LFO_RATE_HZ = 0.3;
const LFO_MAX_DEPTH = 400;

export function createRingModEffect(ctx: BaseAudioContext): Effect {
  const ringGain = ctx.createGain();
  ringGain.gain.value = 0;

  const carrier = ctx.createOscillator();
  carrier.type = "sine";
  carrier.frequency.value = CARRIER_MIN;
  carrier.connect(ringGain.gain);
  carrier.start();

  const lfo = ctx.createOscillator();
  lfo.type = "sine";
  lfo.frequency.value = LFO_RATE_HZ;
  const lfoDepth = ctx.createGain();
  lfoDepth.gain.value = 0;
  lfo.connect(lfoDepth);
  lfoDepth.connect(carrier.frequency);
  lfo.start();

  const mix = createWetDryMix(ctx, ringGain, ringGain);

  return {
    name: "ringMod",
    input: mix.input,
    output: mix.output,
    setParams(params: EffectParams, audioCtx: BaseAudioContext) {
      const carrierFreq = logRange(params.x, CARRIER_MIN, CARRIER_MAX);
      smoothSet(carrier.frequency, carrierFreq, audioCtx);
      smoothSet(lfoDepth.gain, params.y * LFO_MAX_DEPTH, audioCtx);
      smoothSet(mix.wetGain.gain, params.wet, audioCtx);
      smoothSet(mix.dryGain.gain, 1 - params.wet, audioCtx);
    },
    dispose() {
      carrier.stop();
      lfo.stop();
      carrier.disconnect();
      lfo.disconnect();
      lfoDepth.disconnect();
      ringGain.disconnect();
      mix.input.disconnect();
      mix.output.disconnect();
    },
  };
}
