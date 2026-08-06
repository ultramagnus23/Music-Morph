// The seam between vision and audio (see architecture diagram in §2). The
// audio engine subscribes to this instead of talking to HandTracker
// directly, so the two subsystems stay independently testable — you can
// drive the audio engine from a debug panel with fake control events
// instead of a webcam (§9 Phase 2's "most valuable thing you will build").

import type { TrackerFrame } from "./handTracker";
import type { HandId } from "./handIdentity";
import type { Posture } from "./postureClassifier";

export interface ControlEvent {
  hand: HandId;
  timestampMs: number;
  posture: Posture | null;
  /** 0 (released) to 1 (fully engaged). Multiply effect wet/param deltas by this. */
  engagement: number;
  /** Wrist position mapped to the calibrated active zone, 0-1 on each axis. */
  x: number;
  y: number;
  pinch: number;
  tilt: number;
}

export type ControlEventListener = (event: ControlEvent) => void;

/** Maps a raw normalized wrist coordinate into the performer's calibrated
 * reach (§7.5 step 3). Values outside [0, 1] before calibration are clamped. */
export interface ActiveZone {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

export const DEFAULT_ACTIVE_ZONE: ActiveZone = { xMin: 0.15, xMax: 0.85, yMin: 0.15, yMax: 0.85 };

function remapClamped(value: number, min: number, max: number): number {
  if (max <= min) return 0.5;
  return Math.min(1, Math.max(0, (value - min) / (max - min)));
}

export class ControlBus {
  private listeners = new Set<ControlEventListener>();
  activeZone: ActiveZone = DEFAULT_ACTIVE_ZONE;

  subscribe(listener: ControlEventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  publishTrackerFrame(frame: TrackerFrame): void {
    for (const hand of frame.hands) {
      const event: ControlEvent = {
        hand: hand.id,
        timestampMs: frame.timestampMs,
        posture: hand.lifecycle.activePosture,
        engagement: hand.lifecycle.engagement,
        x: remapClamped(hand.wrist[0], this.activeZone.xMin, this.activeZone.xMax),
        // Mirror Y so "up" on screen is "up" in gesture space regardless of
        // image coordinate convention.
        y: 1 - remapClamped(hand.wrist[1], this.activeZone.yMin, this.activeZone.yMax),
        pinch: hand.pinch,
        tilt: hand.tilt,
      };
      for (const listener of this.listeners) listener(event);
    }
  }

  /** Emit a synthetic event without a webcam attached. Debug panel / tests. */
  publishSynthetic(event: ControlEvent): void {
    for (const listener of this.listeners) listener(event);
  }
}
