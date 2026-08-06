// Per-hand engage/disengage lifecycle, §3.6.
//
//         posture stable N frames
// IDLE ──────────────────────────► ARMED
//   ▲                                │  pinch > 0.15  OR  wrist above y-threshold
//   │                                ▼
//   │                            ENGAGED ◄──── params track hand continuously
//   │                                │  pinch < 0.10  OR  posture → NEUTRAL
//   │  ramp complete                 │       OR  hand lost from frame
//   └──────── RELEASING ◄────────────┘
//
// The single most important reliability rule in the app: a hand that leaves
// the frame must not leave a stuck effect. RELEASING always ramps params to
// neutral over 250ms with an exponential curve — never snap, never freeze.

import type { Posture } from "./postureClassifier";

export type HandLifecycleState = "IDLE" | "ARMED" | "ENGAGED" | "RELEASING";

export interface HandStateMachineConfig {
  postureStabilityFrames: number; // N = 5
  engageThreshold: number; // pinch > 0.15
  disengageThreshold: number; // pinch < 0.10
  releaseDurationMs: number; // 250ms
  wristEngageY: number | null; // optional alternative engage trigger; null = pinch-only
}

export const DEFAULT_HAND_STATE_CONFIG: HandStateMachineConfig = {
  postureStabilityFrames: 4,
  engageThreshold: 0.15,
  disengageThreshold: 0.1,
  releaseDurationMs: 250,
  wristEngageY: null,
};

export interface HandStateMachineInput {
  posture: Posture;
  pinch: number;
  wristY: number;
  handPresent: boolean;
  nowMs: number;
}

export interface HandStateMachineOutput {
  state: HandLifecycleState;
  activePosture: Posture | null;
  /** 0 at fully released, 1 at fully engaged. Multiply raw effect params by this
   * during RELEASING so they ease to neutral instead of snapping. */
  engagement: number;
}

/** Exponential ease-out: fast at first, settling into the target. Matches the
 * "ease-out-quart"-flavoured motion language used elsewhere in the spec (§7.4) —
 * no bounce, no overshoot, because overshoot here would imply overshoot in the
 * audio, which would be a lie. */
function easeOutExpo(t: number): number {
  return t >= 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

export class HandStateMachine {
  private state: HandLifecycleState = "IDLE";
  private stablePosture: Posture | null = null;
  private candidatePosture: Posture | null = null;
  private candidateFrames = 0;
  private releaseStartMs = 0;
  private releaseStartEngagement = 1;

  constructor(private config: HandStateMachineConfig = DEFAULT_HAND_STATE_CONFIG) {}

  reset(): void {
    this.state = "IDLE";
    this.stablePosture = null;
    this.candidatePosture = null;
    this.candidateFrames = 0;
  }

  step(input: HandStateMachineInput): HandStateMachineOutput {
    const { posture, pinch, wristY, handPresent, nowMs } = input;
    const cfg = this.config;

    if (!handPresent) {
      if (this.state === "ENGAGED") this.beginRelease(nowMs, 1);
      else if (this.state !== "RELEASING") this.state = "IDLE";
    } else {
      // Posture debouncing: require N consecutive stable frames before it
      // "counts", independent of lifecycle state.
      if (posture === this.candidatePosture) {
        this.candidateFrames++;
      } else {
        this.candidatePosture = posture;
        this.candidateFrames = 1;
      }
      if (this.candidateFrames >= cfg.postureStabilityFrames) {
        this.stablePosture = posture;
      }

      switch (this.state) {
        case "IDLE":
          if (this.stablePosture && this.stablePosture !== "NEUTRAL" && this.stablePosture !== "UNKNOWN") {
            this.state = "ARMED";
          }
          break;

        case "ARMED": {
          const wristTriggered = cfg.wristEngageY !== null && wristY < cfg.wristEngageY;
          if (pinch > cfg.engageThreshold || wristTriggered) {
            this.state = "ENGAGED";
          } else if (this.stablePosture === "NEUTRAL" || this.stablePosture === "UNKNOWN") {
            this.state = "IDLE";
          }
          break;
        }

        case "ENGAGED": {
          const shouldDisengage =
            pinch < cfg.disengageThreshold || this.stablePosture === "NEUTRAL" || this.stablePosture === "UNKNOWN";
          if (shouldDisengage) this.beginRelease(nowMs, 1);
          break;
        }

        case "RELEASING":
          // A fresh engage during release is allowed to interrupt the ramp
          // immediately — the performer re-engaged, don't fight them.
          if (pinch > cfg.engageThreshold) this.state = "ENGAGED";
          break;
      }
    }

    if (this.state === "RELEASING") {
      const elapsed = nowMs - this.releaseStartMs;
      const t = Math.min(1, elapsed / cfg.releaseDurationMs);
      const engagement = this.releaseStartEngagement * (1 - easeOutExpo(t));
      if (t >= 1) {
        this.state = "IDLE";
        this.stablePosture = null;
        return { state: "IDLE", activePosture: null, engagement: 0 };
      }
      return { state: "RELEASING", activePosture: this.stablePosture, engagement };
    }

    const engagement = this.state === "ENGAGED" ? 1 : 0;
    const activePosture = this.state === "ENGAGED" || this.state === "ARMED" ? this.stablePosture : null;
    return { state: this.state, activePosture, engagement };
  }

  private beginRelease(nowMs: number, fromEngagement: number): void {
    this.state = "RELEASING";
    this.releaseStartMs = nowMs;
    this.releaseStartEngagement = fromEngagement;
  }
}
