// Stable left/right identity across frames, §3.6: "do not trust MediaPipe's
// handedness label frame to frame... assign identity by nearest-neighbour
// matching to the previous frame's wrist positions, with the handedness
// label as a tiebreaker only on first acquisition."

import { WRIST } from "./landmarks";
import type { RawHandDetection, Vec3 } from "./landmarks";

export type HandId = "left" | "right";

interface TrackedHand {
  id: HandId;
  lastWrist: Vec3;
  framesSinceSeen: number;
}

const MAX_FRAMES_LOST = 15; // ~250ms at 60fps before we consider identity gone

function dist(a: Vec3, b: Vec3): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

export class HandIdentityTracker {
  private tracked = new Map<HandId, TrackedHand>();

  /** Assigns stable ids to this frame's raw detections (0, 1, or 2 hands). */
  assign(detections: RawHandDetection[]): Map<HandId, RawHandDetection> {
    const result = new Map<HandId, RawHandDetection>();
    const unassigned = [...detections];

    // Nearest-neighbour to previously tracked hands first.
    for (const [id, prev] of this.tracked) {
      if (unassigned.length === 0) break;
      let bestIdx = -1;
      let bestDist = Infinity;
      for (let i = 0; i < unassigned.length; i++) {
        const d = dist(unassigned[i].landmarks[WRIST], prev.lastWrist);
        if (d < bestDist) {
          bestDist = d;
          bestIdx = i;
        }
      }
      if (bestIdx >= 0) {
        const detection = unassigned.splice(bestIdx, 1)[0];
        result.set(id, detection);
        this.tracked.set(id, { id, lastWrist: detection.landmarks[WRIST], framesSinceSeen: 0 });
      }
    }

    // Remaining detections are new acquisitions — use the handedness label
    // as the only tiebreaker, per spec. Falls back to whichever slot ("left"
    // or "right") is free.
    for (const detection of unassigned) {
      const preferred: HandId = detection.handedness === "Left" ? "left" : "right";
      const id: HandId = !result.has(preferred) && !this.tracked.has(preferred) ? preferred : this.otherSlot(preferred, result);
      result.set(id, detection);
      this.tracked.set(id, { id, lastWrist: detection.landmarks[WRIST], framesSinceSeen: 0 });
    }

    // Age out hands that vanished; forget identity after MAX_FRAMES_LOST so a
    // hand re-entering later re-acquires by handedness rather than snapping
    // to a stale position.
    for (const [id, hand] of this.tracked) {
      if (!result.has(id)) {
        hand.framesSinceSeen++;
        if (hand.framesSinceSeen > MAX_FRAMES_LOST) this.tracked.delete(id);
      }
    }

    return result;
  }

  private otherSlot(preferred: HandId, result: Map<HandId, RawHandDetection>): HandId {
    const other: HandId = preferred === "left" ? "right" : "left";
    return result.has(other) ? preferred : other;
  }

  reset(): void {
    this.tracked.clear();
  }
}
