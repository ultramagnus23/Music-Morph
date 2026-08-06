// Default gesture map, §3.7. Left hand = texture and space, right hand =
// time and rhythm — the asymmetry is deliberate and intentionally not
// user-configurable by default (it matches how DJs actually work), though
// the map is data so a settings screen can override it later.

import type { HandId } from "../vision/handIdentity";
import type { Posture } from "../vision/postureClassifier";
import type { EffectSlotName } from "./deck";

export interface GestureMapping {
  slot: EffectSlotName;
  /** Ranges are documented per-effect in effects/*.ts; this map only says
   * which posture activates which slot, not the numeric ranges. */
  description: string;
}

export type GestureMap = Record<HandId, Partial<Record<Posture, GestureMapping>>>;

export const DEFAULT_GESTURE_MAP: GestureMap = {
  left: {
    FIST: { slot: "filterLowpass", description: "Low-pass filter: X cutoff, Y resonance" },
    POINT: { slot: "filterHighpass", description: "High-pass filter: X cutoff, Y resonance" },
    PEACE: { slot: "reverb", description: "Reverb: X room size, Y pre-delay" },
    HORNS: { slot: "bitcrush", description: "Bitcrush: X bit depth, Y sample rate" },
    THUMB: { slot: "saturation", description: "Saturation/drive: X drive, Y tone" },
  },
  right: {
    FIST: { slot: "beatRepeat", description: "Beat-repeat/stutter: X division, Y pitch offset" },
    POINT: { slot: "delay", description: "Tempo-synced delay: X time division, Y feedback" },
    PEACE: { slot: "gate", description: "Trance gate: X rate, Y duty cycle" },
    HORNS: { slot: "ringMod", description: "Ring modulator: X carrier freq, Y LFO depth" },
    THUMB: { slot: "reverseBuffer", description: "Reverse buffer: X buffer length" },
  },
};

/** Every slot that a given hand could ever drive — used to know which slots
 * to zero out when that hand disengages. */
export function slotsForHand(hand: HandId, map: GestureMap = DEFAULT_GESTURE_MAP): Set<EffectSlotName> {
  return new Set(Object.values(map[hand]).map((m) => m.slot));
}
