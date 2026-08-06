// First-run flow, §7.5. Four steps, run once before any music plays:
// camera check -> posture tutorial -> calibration -> first sound. Step 3
// (calibration) must not be skipped — ergonomic reach varies enormously
// with height/table/arm length and a fixed active zone will feel wrong for
// most people.
//
// TODO(Phase 8): build the actual step UI (camera framing hints, posture
// hold-and-confirm, reach calibration prompts). This scaffolds the state
// machine and the calibration math so audio/vision wiring doesn't have to
// wait on final onboarding visuals.

import type { ActiveZone } from "../vision/controlBus";

export type OnboardingStep = "cameraCheck" | "postureTutorial" | "calibration" | "firstSound" | "done";

export interface CalibrationSample {
  direction: "left" | "right" | "up" | "down";
  wristX: number;
  wristY: number;
}

/** Turns four reach samples ("reach as far left as comfortable... now
 * right... now up... now down") into the performer's active zone, §7.5
 * step 3. Includes a small margin so the very edge of comfortable reach
 * still reads as "fully engaged" rather than clipping at 0/1. */
export function computeActiveZone(samples: CalibrationSample[]): ActiveZone {
  const margin = 0.05;
  const left = samples.find((s) => s.direction === "left");
  const right = samples.find((s) => s.direction === "right");
  const up = samples.find((s) => s.direction === "up");
  const down = samples.find((s) => s.direction === "down");

  const xs = [left?.wristX, right?.wristX].filter((v): v is number => v !== undefined);
  const ys = [up?.wristY, down?.wristY].filter((v): v is number => v !== undefined);

  const xMin = xs.length ? Math.min(...xs) - margin : 0.15;
  const xMax = xs.length ? Math.max(...xs) + margin : 0.85;
  const yMin = ys.length ? Math.min(...ys) - margin : 0.15;
  const yMax = ys.length ? Math.max(...ys) + margin : 0.85;

  return { xMin, xMax, yMin, yMax };
}

const STEP_ORDER: OnboardingStep[] = ["cameraCheck", "postureTutorial", "calibration", "firstSound", "done"];

export class OnboardingFlow {
  private stepIndex = 0;

  get currentStep(): OnboardingStep {
    return STEP_ORDER[this.stepIndex];
  }

  advance(): OnboardingStep {
    this.stepIndex = Math.min(this.stepIndex + 1, STEP_ORDER.length - 1);
    return this.currentStep;
  }

  reset(): void {
    this.stepIndex = 0;
  }
}
