// Equal-power crossfade between the two decks, driven either by the
// two-hand "hands apart/together" gesture (§3.7) or manually during a
// planned transition (§6.3).

import { smoothSet } from "./paramSmoothing";

export class Crossfader {
  private gainA: GainNode;
  private gainB: GainNode;
  readonly output: GainNode;

  constructor(private ctx: AudioContext, deckAOutput: AudioNode, deckBOutput: AudioNode) {
    this.gainA = ctx.createGain();
    this.gainB = ctx.createGain();
    this.output = ctx.createGain();

    deckAOutput.connect(this.gainA);
    deckBOutput.connect(this.gainB);
    this.gainA.connect(this.output);
    this.gainB.connect(this.output);

    this.setPosition(0);
  }

  /** @param position 0 = full deck A, 1 = full deck B */
  setPosition(position: number): void {
    const clamped = Math.min(1, Math.max(0, position));
    // Equal-power curve: sin/cos taper so the perceived loudness stays
    // constant through the middle of the sweep, not just a linear dip.
    const angle = clamped * (Math.PI / 2);
    smoothSet(this.gainA.gain, Math.cos(angle), this.ctx, 0.02);
    smoothSet(this.gainB.gain, Math.sin(angle), this.ctx, 0.02);
  }

  dispose(): void {
    this.gainA.disconnect();
    this.gainB.disconnect();
    this.output.disconnect();
  }
}
