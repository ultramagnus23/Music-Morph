// Left THUMB: saturation/drive. X = drive 0-36dB, Y = tone (tilt EQ), pinch = wet.

import { createWetDryMix, type Effect, type EffectParams } from "./types";
import { linRange, smoothSet } from "../paramSmoothing";

const DRIVE_MIN_DB = 0;
const DRIVE_MAX_DB = 36;

function makeSaturationCurve(driveDb: number): Float32Array<ArrayBuffer> {
  const amount = Math.pow(10, driveDb / 20);
  const samples = 1024;
  const curve = new Float32Array(new ArrayBuffer(samples * Float32Array.BYTES_PER_ELEMENT));
  for (let i = 0; i < samples; i++) {
    const x = (i / (samples - 1)) * 2 - 1;
    curve[i] = Math.tanh(x * amount) / Math.tanh(amount || 1e-6);
  }
  return curve;
}

export function createSaturationEffect(ctx: BaseAudioContext): Effect {
  const shaper = ctx.createWaveShaper();
  shaper.curve = makeSaturationCurve(DRIVE_MIN_DB);
  shaper.oversample = "4x";

  // Tilt EQ: shelf pair, boost highs / cut lows as tone increases (and vice versa).
  const lowShelf = ctx.createBiquadFilter();
  lowShelf.type = "lowshelf";
  lowShelf.frequency.value = 400;

  const highShelf = ctx.createBiquadFilter();
  highShelf.type = "highshelf";
  highShelf.frequency.value = 2500;

  shaper.connect(lowShelf);
  lowShelf.connect(highShelf);

  const mix = createWetDryMix(ctx, shaper, highShelf);

  return {
    name: "saturation",
    input: mix.input,
    output: mix.output,
    setParams(params: EffectParams, audioCtx: BaseAudioContext) {
      const driveDb = linRange(params.x, DRIVE_MIN_DB, DRIVE_MAX_DB);
      shaper.curve = makeSaturationCurve(driveDb);

      const tilt = params.y * 2 - 1; // -1..1
      smoothSet(lowShelf.gain, -6 * tilt, audioCtx);
      smoothSet(highShelf.gain, 6 * tilt, audioCtx);

      smoothSet(mix.wetGain.gain, params.wet, audioCtx);
      smoothSet(mix.dryGain.gain, 1 - params.wet, audioCtx);
    },
    dispose() {
      shaper.disconnect();
      lowShelf.disconnect();
      highShelf.disconnect();
      mix.input.disconnect();
      mix.output.disconnect();
    },
  };
}
