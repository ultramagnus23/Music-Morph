// Subscribes to the ControlBus and drives one deck's effect chain per
// DEFAULT_GESTURE_MAP. This is the only place vision events turn into audio
// param writes — everything upstream (Deck, effects/*) is agnostic to
// gestures entirely, and everything downstream (HandTracker, ControlBus) is
// agnostic to audio entirely.

import type { ControlBus, ControlEvent } from "../vision/controlBus";
import type { Deck } from "./deck";
import { DEFAULT_GESTURE_MAP, slotsForHand, type GestureMap } from "./gestureEffectMap";

export class GestureEffectRouter {
  private unsubscribe: (() => void) | null = null;

  constructor(
    private controlBus: ControlBus,
    private deck: Deck,
    private map: GestureMap = DEFAULT_GESTURE_MAP,
  ) {}

  start(): void {
    this.unsubscribe = this.controlBus.subscribe((event) => this.handle(event));
  }

  stop(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
  }

  private handle(event: ControlEvent): void {
    const bpm = this.deck.beatClock.bpm;
    const handMap = this.map[event.hand];
    const mapping = event.posture ? handMap[event.posture] : undefined;
    const allSlotsForHand = slotsForHand(event.hand, this.map);

    if (mapping) {
      this.deck.setEffectParams(mapping.slot, {
        x: event.x,
        y: event.y,
        wet: event.pinch * event.engagement,
        bpm,
      });
      const others = new Set(allSlotsForHand);
      others.delete(mapping.slot);
      for (const slot of others) {
        this.deck.setEffectParams(slot, { x: 0.5, y: 0.5, wet: 0, bpm });
      }
    } else {
      // No active posture for this hand this frame (IDLE/RELEASING/NEUTRAL) —
      // zero every slot this hand could control so nothing sticks.
      for (const slot of allSlotsForHand) {
        this.deck.setEffectParams(slot, { x: 0.5, y: 0.5, wet: 0, bpm });
      }
    }
  }
}
