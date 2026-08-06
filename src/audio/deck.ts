// One deck: source -> isolator EQ -> gesture effect chain (fixed order,
// §4.2) -> deck gain -> (connected externally to the crossfader). Two decks
// exist so Mode A can beat-match transitions (§2.1) — Mode B/C decks don't
// apply.

import { createIsolatorEQ, type IsolatorEQ } from "./effects/isolatorEQ";
import { createBitcrushEffect } from "./effects/bitcrush";
import { createSaturationEffect } from "./effects/saturation";
import { createFilterEffect } from "./effects/filter";
import { createRingModEffect } from "./effects/ringMod";
import { createBeatRepeatEffect } from "./effects/beatRepeat";
import { createReverseBufferEffect } from "./effects/reverseBuffer";
import { createGateEffect } from "./effects/gate";
import { createDelayEffect } from "./effects/delay";
import { createReverbEffect } from "./effects/reverb";
import type { Effect, EffectParams } from "./effects/types";
import { BeatClock, type Beatgrid } from "./beatClock";
import { smoothSet } from "./paramSmoothing";

export type EffectSlotName =
  | "bitcrush"
  | "saturation"
  | "filterLowpass"
  | "filterHighpass"
  | "ringMod"
  | "beatRepeat"
  | "reverseBuffer"
  | "gate"
  | "delay"
  | "reverb";

export class Deck {
  readonly output: GainNode;
  readonly isolator: IsolatorEQ;
  readonly beatClock = new BeatClock();
  readonly effects: Record<EffectSlotName, Effect>;

  private sourceNode: AudioBufferSourceNode | null = null;
  private buffer: AudioBuffer | null = null;
  private startedAtContextTime = 0;
  private startedAtPlayheadSeconds = 0;

  constructor(private ctx: AudioContext) {
    this.output = ctx.createGain();
    this.isolator = createIsolatorEQ(ctx);

    // Fixed chain order, §4.2: isolator -> bitcrush -> saturation -> filter
    // (LP then HP; mutually exclusive via wet) -> ring mod -> buffer effect
    // (beat-repeat / reverse; mutually exclusive) -> gate -> delay -> reverb.
    this.effects = {
      bitcrush: createBitcrushEffect(ctx),
      saturation: createSaturationEffect(ctx),
      filterLowpass: createFilterEffect(ctx, "lowpass"),
      filterHighpass: createFilterEffect(ctx, "highpass"),
      ringMod: createRingModEffect(ctx),
      beatRepeat: createBeatRepeatEffect(ctx),
      reverseBuffer: createReverseBufferEffect(ctx),
      gate: createGateEffect(ctx),
      delay: createDelayEffect(ctx),
      reverb: createReverbEffect(ctx),
    };

    const order: EffectSlotName[] = [
      "bitcrush",
      "saturation",
      "filterLowpass",
      "filterHighpass",
      "ringMod",
      "beatRepeat",
      "reverseBuffer",
      "gate",
      "delay",
      "reverb",
    ];

    this.isolator.output.connect(this.effects[order[0]].input);
    for (let i = 0; i < order.length - 1; i++) {
      this.effects[order[i]].output.connect(this.effects[order[i + 1]].input);
    }
    this.effects[order[order.length - 1]].output.connect(this.output);
  }

  loadBuffer(buffer: AudioBuffer, beatgrid: Beatgrid): void {
    this.buffer = buffer;
    this.beatClock.setGrid(beatgrid);
  }

  play(fromSeconds = 0): void {
    if (!this.buffer) throw new Error("Deck.loadBuffer() before play()");
    this.stop();
    const source = this.ctx.createBufferSource();
    source.buffer = this.buffer;
    // TODO(Phase 5): replace direct connection with a Rubber Band
    // time-stretch AudioWorklet so tempo-matching doesn't pitch-shift.
    // playbackRate is a placeholder for tempo changes until then.
    source.connect(this.isolator.input);
    source.start(0, fromSeconds);
    this.sourceNode = source;
    this.startedAtContextTime = this.ctx.currentTime;
    this.startedAtPlayheadSeconds = fromSeconds;
  }

  stop(): void {
    this.sourceNode?.stop();
    this.sourceNode?.disconnect();
    this.sourceNode = null;
  }

  get playheadSeconds(): number {
    if (!this.sourceNode) return this.startedAtPlayheadSeconds;
    return this.startedAtPlayheadSeconds + (this.ctx.currentTime - this.startedAtContextTime) * this.sourceNode.playbackRate.value;
  }

  setGain(value01: number): void {
    smoothSet(this.output.gain, value01, this.ctx);
  }

  /** Applies gesture-driven params to one effect slot. Called by
   * GestureEffectRouter, not directly by UI code. */
  setEffectParams(slot: EffectSlotName, params: EffectParams): void {
    this.effects[slot].setParams(params, this.ctx);
  }

  /** Zeroes wet on every slot except the given set — used when a hand
   * disengages so effects that lost their controlling posture don't get
   * stuck at their last value (mirrors the RELEASING ramp in
   * handStateMachine.ts, but at the audio-param level). */
  releaseAllExcept(active: Set<EffectSlotName>, bpm: number): void {
    for (const [name, effect] of Object.entries(this.effects) as [EffectSlotName, Effect][]) {
      if (!active.has(name)) {
        effect.setParams({ x: 0.5, y: 0.5, wet: 0, bpm }, this.ctx);
      }
    }
  }

  dispose(): void {
    this.stop();
    for (const effect of Object.values(this.effects)) effect.dispose();
    this.isolator.dispose();
    this.output.disconnect();
  }
}
