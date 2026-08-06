// Two-hand gestures, §3.7 table. These operate on the raw TrackerFrame (both
// hands at once) rather than per-hand ControlEvents, since they need
// relative position/velocity between hands or synchronized posture.
//
// TODO(Phase 3): implement velocity-based detection (tape stop, skip) once
// the effect chain exists to react to them. Crossfade and freeze/panic only
// need position and posture, so they're the cheapest to wire up first.

import type { HandFrame, TrackerFrame } from "./handTracker";

export type TwoHandGesture =
  | { type: "crossfade"; position: number } // 0 = full A, 1 = full B
  | { type: "tapeStop" }
  | { type: "skip" }
  | { type: "freeze" }
  | { type: "panic" };

const FREEZE_HOLD_MS = 400;
const PANIC_HOLD_MS = 300;
const SWIPE_VELOCITY_THRESHOLD = 2.5; // scale-units/s, wrist-to-wrist normalized

interface VelocityTracker {
  prevWrist: [number, number] | null;
  prevMs: number | null;
}

export class TwoHandGestureDetector {
  private velocity = new Map<string, VelocityTracker>();
  private fistHoldStartMs: number | null = null;
  private raisedHoldStartMs: number | null = null;

  detect(frame: TrackerFrame): TwoHandGesture[] {
    const results: TwoHandGesture[] = [];
    const left = frame.hands.find((h) => h.id === "left");
    const right = frame.hands.find((h) => h.id === "right");

    if (left && right) {
      const bothNeutral = left.lifecycle.state === "IDLE" && right.lifecycle.state === "IDLE";
      if (bothNeutral) {
        const dist = Math.hypot(left.wrist[0] - right.wrist[0], left.wrist[1] - right.wrist[1]);
        results.push({ type: "crossfade", position: Math.min(1, Math.max(0, dist)) });
      }

      const bothFist = left.lifecycle.activePosture === "FIST" && right.lifecycle.activePosture === "FIST";
      results.push(...this.holdGesture(bothFist, frame.timestampMs, "fist", FREEZE_HOLD_MS, { type: "freeze" }));

      const bothRaisedNeutral = bothNeutral && left.wrist[1] < 0.3 && right.wrist[1] < 0.3;
      results.push(
        ...this.holdGesture(bothRaisedNeutral, frame.timestampMs, "raised", PANIC_HOLD_MS, { type: "panic" }),
      );
    }

    for (const hand of frame.hands) {
      const swipe = this.detectSwipe(hand, frame.timestampMs);
      if (swipe) results.push(swipe);
    }

    return results;
  }

  private holdGesture(
    active: boolean,
    nowMs: number,
    key: "fist" | "raised",
    holdMs: number,
    gesture: TwoHandGesture,
  ): TwoHandGesture[] {
    const startField = key === "fist" ? "fistHoldStartMs" : "raisedHoldStartMs";
    if (!active) {
      this[startField] = null;
      return [];
    }
    if (this[startField] === null) {
      this[startField] = nowMs;
      return [];
    }
    if (nowMs - this[startField]! >= holdMs) {
      this[startField] = null; // fire once
      return [gesture];
    }
    return [];
  }

  private detectSwipe(hand: HandFrame, nowMs: number): TwoHandGesture | null {
    const tracker = this.velocity.get(hand.id) ?? { prevWrist: null, prevMs: null };
    const [x, y] = hand.wrist;

    let result: TwoHandGesture | null = null;
    if (tracker.prevWrist && tracker.prevMs !== null) {
      const dt = Math.max((nowMs - tracker.prevMs) / 1000, 1e-3);
      const vx = (x - tracker.prevWrist[0]) / dt;
      const vy = (y - tracker.prevWrist[1]) / dt;
      if (Math.abs(vy) > 2.2 && vy > Math.abs(vx)) result = { type: "tapeStop" };
      else if (Math.abs(vx) > SWIPE_VELOCITY_THRESHOLD && Math.abs(vx) > Math.abs(vy)) result = { type: "skip" };
    }

    this.velocity.set(hand.id, { prevWrist: [x, y], prevMs: nowMs });
    return result;
  }
}
