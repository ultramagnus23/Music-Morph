// Common shape for every node in the fixed effect chain (§4.2). Each effect
// is always connected — "bypassed" means wet=0, not disconnected — so
// gesture engage/disengage never causes a graph rebuild click.

export interface EffectParams {
  x: number; // 0-1, first gesture axis
  y: number; // 0-1, second gesture axis
  wet: number; // 0-1, from pinch
  /** Active deck's BPM, for tempo-synced effects (delay, gate, beat-repeat). */
  bpm: number;
}

export interface Effect {
  readonly name: string;
  readonly input: AudioNode;
  readonly output: AudioNode;
  setParams(params: EffectParams, ctx: BaseAudioContext): void;
  dispose(): void;
}

/** Builds a dry/wet mix around a wet processing subgraph: input splits into
 * a dry path and the wet subgraph, both summed at output via gains crossfaded
 * by `wet`. Every concrete effect below is built on this. */
export function createWetDryMix(
  ctx: BaseAudioContext,
  wetSubgraphInput: AudioNode,
  wetSubgraphOutput: AudioNode,
): { input: GainNode; output: GainNode; dryGain: GainNode; wetGain: GainNode } {
  const input = ctx.createGain();
  const output = ctx.createGain();
  const dryGain = ctx.createGain();
  const wetGain = ctx.createGain();

  dryGain.gain.value = 1;
  wetGain.gain.value = 0;

  input.connect(dryGain);
  dryGain.connect(output);

  input.connect(wetSubgraphInput);
  wetSubgraphOutput.connect(wetGain);
  wetGain.connect(output);

  return { input, output, dryGain, wetGain };
}
