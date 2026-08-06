// 3-band isolator EQ, §4.1 — bass/mid/high kill. Sits at the head of each
// deck's chain, ahead of the gesture effects. Not gesture-driven by default;
// exposed for the bass-swap crossfade transition (§6.3 step 4) to drive
// directly.

export interface IsolatorEQ {
  input: AudioNode;
  output: AudioNode;
  setBandGain(band: "low" | "mid" | "high", gainDb: number, ctx: BaseAudioContext): void;
  dispose(): void;
}

export function createIsolatorEQ(ctx: BaseAudioContext): IsolatorEQ {
  const low = ctx.createBiquadFilter();
  low.type = "lowshelf";
  low.frequency.value = 250;

  const mid = ctx.createBiquadFilter();
  mid.type = "peaking";
  mid.frequency.value = 1000;
  mid.Q.value = 0.7;

  const high = ctx.createBiquadFilter();
  high.type = "highshelf";
  high.frequency.value = 4000;

  low.connect(mid);
  mid.connect(high);

  const nodes = { low, mid, high };

  return {
    input: low,
    output: high,
    setBandGain(band, gainDb, audioCtx) {
      nodes[band].gain.setTargetAtTime(gainDb, audioCtx.currentTime, 0.012);
    },
    dispose() {
      low.disconnect();
      mid.disconnect();
      high.disconnect();
    },
  };
}
