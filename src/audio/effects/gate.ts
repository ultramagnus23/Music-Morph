// Right PEACE: trance gate. X = rate (1/4 to 1/32, stepped, tempo-synced), Y
// = duty cycle 10-90%, pinch = depth.
//
// Implemented as a scheduled square-wave gain envelope rather than an
// AudioWorklet: on every setParams call (driven by gesture updates, so
// several times a second) we re-schedule a short lookahead window of
// setValueAtTime steps on the gain param. Cheap, and avoids a worklet just
// for this one effect.

import { createWetDryMix, type Effect, type EffectParams } from "./types";

const RATES_BEATS = [1, 0.5, 0.25, 0.125, 0.0625] as const; // 1/4 .. 1/32 in beats
const LOOKAHEAD_SECONDS = 1.5;

function stepIndex(x: number, count: number): number {
  return Math.min(count - 1, Math.floor(x * count));
}

export function createGateEffect(ctx: BaseAudioContext): Effect {
  const gateGain = ctx.createGain();
  gateGain.gain.value = 1;

  const mix = createWetDryMix(ctx, gateGain, gateGain);
  // Gate is inserted purely in series on the wet path's own gain automation;
  // dry path stays untouched so "wet" here acts as gate depth, not mix.
  mix.dryGain.gain.value = 1;
  mix.wetGain.gain.value = 0;

  let scheduledUntil = 0;

  return {
    name: "gate",
    input: mix.input,
    output: mix.output,
    setParams(params: EffectParams, audioCtx: BaseAudioContext) {
      const bpm = params.bpm > 0 ? params.bpm : 120;
      const secondsPerBeat = 60 / bpm;
      const periodSeconds = RATES_BEATS[stepIndex(params.x, RATES_BEATS.length)] * secondsPerBeat;
      const dutyCycle = 0.1 + params.y * 0.8;
      const depth = params.wet;

      const now = audioCtx.currentTime;
      if (scheduledUntil < now) scheduledUntil = now;

      const highLevel = 1;
      const lowLevel = 1 - depth;
      const target = scheduledUntil + LOOKAHEAD_SECONDS;
      let t = scheduledUntil;
      while (t < target) {
        gateGain.gain.setValueAtTime(highLevel, t);
        gateGain.gain.setValueAtTime(lowLevel, t + periodSeconds * dutyCycle);
        t += periodSeconds;
      }
      scheduledUntil = t;

      mix.wetGain.gain.setValueAtTime(depth > 0 ? 1 : 0, now);
      mix.dryGain.gain.setValueAtTime(depth > 0 ? 0 : 1, now);
    },
    dispose() {
      gateGain.disconnect();
      mix.input.disconnect();
      mix.output.disconnect();
    },
  };
}
