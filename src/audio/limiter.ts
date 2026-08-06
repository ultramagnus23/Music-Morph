// Master bus: glue compressor -> brickwall limiter, §4.1. Mandatory —
// resonant filter sweeps and heavy saturation will clip without it, and
// clipping on a party speaker sounds like broken equipment.

const CEILING_DB = -0.3;

export interface MasterBus {
  input: AudioNode;
  dispose(): void;
}

export function createMasterBus(ctx: AudioContext, destination: AudioNode): MasterBus {
  const glueCompressor = ctx.createDynamicsCompressor();
  glueCompressor.threshold.value = -18;
  glueCompressor.knee.value = 12;
  glueCompressor.ratio.value = 3;
  glueCompressor.attack.value = 0.01;
  glueCompressor.release.value = 0.25;

  // DynamicsCompressorNode isn't a true brickwall limiter, but with a high
  // ratio, fast attack, and threshold set to the ceiling it gets close.
  // TODO: swap for a proper lookahead brickwall limiter (AudioWorklet) if
  // resonant sweeps still poke through — see §8 "clipping on resonant sweep".
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = CEILING_DB;
  limiter.knee.value = 0;
  limiter.ratio.value = 20;
  limiter.attack.value = 0.001;
  limiter.release.value = 0.05;

  glueCompressor.connect(limiter);
  limiter.connect(destination);

  return {
    input: glueCompressor,
    dispose() {
      glueCompressor.disconnect();
      limiter.disconnect();
    },
  };
}
