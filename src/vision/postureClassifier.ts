// Six-posture vocabulary, §3.5. Chosen so no two postures are one-finger-away
// from each other (kills most misclassification at posture boundaries).
// Three- and four-finger poses are deliberately excluded.

import type { HandFeatures } from "./featureExtraction";

export type Posture = "NEUTRAL" | "FIST" | "POINT" | "PEACE" | "HORNS" | "THUMB" | "UNKNOWN";

/** [thumb, index, middle, ring, pinky] extension bitmask per posture. */
export const POSTURE_BITMASKS: Record<Exclude<Posture, "UNKNOWN">, [boolean, boolean, boolean, boolean, boolean]> = {
  NEUTRAL: [true, true, true, true, true],
  FIST: [false, false, false, false, false],
  POINT: [false, true, false, false, false],
  PEACE: [false, true, true, false, false],
  HORNS: [false, true, false, false, true],
  THUMB: [true, false, false, false, false],
};

function toBitmask(f: HandFeatures): [boolean, boolean, boolean, boolean, boolean] {
  return [f.thumb, f.fingers.index, f.fingers.middle, f.fingers.ring, f.fingers.pinky];
}

/** Classifies a posture from the current frame's features. No temporal logic here —
 * hysteresis lives in HandStateMachine. Falls back to UNKNOWN (treated as "hold
 * last stable posture") if the bitmask doesn't exactly match a known pose. */
export function classifyPosture(features: HandFeatures): Posture {
  const bits = toBitmask(features);
  for (const [posture, mask] of Object.entries(POSTURE_BITMASKS) as [
    Exclude<Posture, "UNKNOWN">,
    [boolean, boolean, boolean, boolean, boolean],
  ][]) {
    if (mask.every((b, i) => b === bits[i])) return posture;
  }
  return "UNKNOWN";
}
