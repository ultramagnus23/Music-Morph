// Top-level audio graph, §2 / §4.1: Deck A + Deck B -> crossfader -> master
// bus (glue compressor -> limiter) -> output. Owns AudioContext lifecycle
// and worklet module registration.

import { Deck } from "./deck";
import { Crossfader } from "./crossfader";
import { createMasterBus, type MasterBus } from "./limiter";
import { ControlBus } from "../vision/controlBus";
import { GestureEffectRouter } from "./gestureEffectRouter";

const BITCRUSHER_WORKLET_URL = new URL("./worklets/bitcrusher-processor.js", import.meta.url);

export class AudioEngine {
  readonly ctx: AudioContext;
  readonly deckA: Deck;
  readonly deckB: Deck;
  readonly crossfader: Crossfader;
  readonly masterBus: MasterBus;
  readonly controlBus = new ControlBus();

  private routerA: GestureEffectRouter;
  private routerB: GestureEffectRouter;

  private constructor(ctx: AudioContext) {
    this.ctx = ctx;
    this.deckA = new Deck(ctx);
    this.deckB = new Deck(ctx);
    this.crossfader = new Crossfader(ctx, this.deckA.output, this.deckB.output);
    this.masterBus = createMasterBus(ctx, ctx.destination);
    this.crossfader.output.connect(this.masterBus.input);

    // Gestures drive whichever deck is currently "live" for performance
    // effects. Both routers are wired; in practice only one deck is the
    // active performance target at a time — see setActiveDeck().
    this.routerA = new GestureEffectRouter(this.controlBus, this.deckA);
    this.routerB = new GestureEffectRouter(this.controlBus, this.deckB);
  }

  static async create(): Promise<AudioEngine> {
    const ctx = new AudioContext({ latencyHint: "interactive" });
    await ctx.audioWorklet.addModule(BITCRUSHER_WORKLET_URL);
    const engine = new AudioEngine(ctx);
    engine.setActiveDeck("A");
    return engine;
  }

  /** Only the active deck's effect chain responds to gestures — the other
   * deck keeps playing/mixing untouched until a transition hands control
   * over (§6.3 step 6: "deck B becomes deck A"). */
  setActiveDeck(deck: "A" | "B"): void {
    if (deck === "A") {
      this.routerA.start();
      this.routerB.stop();
    } else {
      this.routerB.start();
      this.routerA.stop();
    }
  }

  async decodeFile(arrayBuffer: ArrayBuffer): Promise<AudioBuffer> {
    return this.ctx.decodeAudioData(arrayBuffer);
  }

  dispose(): void {
    this.routerA.stop();
    this.routerB.stop();
    this.deckA.dispose();
    this.deckB.dispose();
    this.crossfader.dispose();
    this.masterBus.dispose();
    this.ctx.close();
  }
}
