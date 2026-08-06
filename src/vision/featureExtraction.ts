// Per-frame feature extraction from smoothed landmarks. See spec §3.3.
// All distances are normalized by hand scale so distance-to-camera doesn't
// affect thresholds.

import { FINGER_INDICES, INDEX_MCP, MIDDLE_MCP, WRIST, type HandLandmarks, type Vec3 } from "./landmarks";

function sub(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

function norm(a: Vec3): number {
  return Math.sqrt(dot(a, a));
}

function normalize(a: Vec3): Vec3 {
  const n = norm(a) || 1e-9;
  return [a[0] / n, a[1] / n, a[2] / n];
}

/** Wrist-to-middle-MCP distance. The unit every other feature is normalized against. */
export function handScale(landmarks: HandLandmarks): number {
  return norm(sub(landmarks[MIDDLE_MCP], landmarks[WRIST]));
}

export type FingerName = "index" | "middle" | "ring" | "pinky";
const EXTENDABLE_FINGERS: FingerName[] = ["index", "middle", "ring", "pinky"];

/** Bitmask-friendly per-finger extension test: a folded finger's tip sits
 * closer to the wrist than its own PIP joint does; an extended finger's tip
 * sits farther away. Ratio-based against the finger's own PIP-to-wrist
 * distance (not a fixed multiple of hand scale), so it holds up across the
 * range of hand rotation/tilt a performer actually uses — a fixed
 * palm-axis-projection threshold turned out to almost never fire true in
 * practice, misclassifying nearly every posture as THUMB. */
export function fingerExtension(landmarks: HandLandmarks): Record<FingerName, boolean> {
  const wrist = landmarks[WRIST];
  const result = {} as Record<FingerName, boolean>;
  for (const finger of EXTENDABLE_FINGERS) {
    const { tip, pip } = FINGER_INDICES[finger];
    const tipDist = norm(sub(landmarks[tip], wrist));
    const pipDist = norm(sub(landmarks[pip], wrist));
    result[finger] = tipDist > pipDist * 1.15;
  }
  return result;
}

/** Thumb extension: same ratio idea, but referenced against the index MCP
 * rather than the wrist, since the thumb folds *across* the palm toward the
 * index finger rather than curling toward the wrist. */
export function thumbExtension(landmarks: HandLandmarks): boolean {
  const indexMcp = landmarks[INDEX_MCP];
  const { tip, mcp } = FINGER_INDICES.thumb;
  const tipDist = norm(sub(landmarks[tip], indexMcp));
  const baseDist = norm(sub(landmarks[mcp], indexMcp));
  return tipDist > baseDist * 1.3;
}

/** Normalized thumb-tip-to-index-tip distance, clamped 0-1. Wet/dry gate and axis. */
export function pinchAmount(landmarks: HandLandmarks): number {
  const scale = handScale(landmarks);
  const { tip: thumbTip } = FINGER_INDICES.thumb;
  const { tip: indexTip } = FINGER_INDICES.index;
  const d = norm(sub(landmarks[thumbTip], landmarks[indexTip]));
  return Math.min(1, Math.max(0, d / (0.55 * scale)));
}

/** Palm normal + tilt angle. A third rotational modulation axis. */
export function palmTilt(landmarks: HandLandmarks): { normal: Vec3; tilt: number } {
  const a = sub(landmarks[5], landmarks[0]);
  const b = sub(landmarks[17], landmarks[0]);
  const normal = normalize(cross(a, b));
  const tilt = Math.atan2(normal[0], normal[2]);
  return { normal, tilt };
}

export interface HandFeatures {
  scale: number;
  fingers: Record<FingerName, boolean>;
  thumb: boolean;
  pinch: number;
  tilt: number;
  wrist: Vec3;
}

export function extractHandFeatures(landmarks: HandLandmarks): HandFeatures {
  return {
    scale: handScale(landmarks),
    fingers: fingerExtension(landmarks),
    thumb: thumbExtension(landmarks),
    pinch: pinchAmount(landmarks),
    tilt: palmTilt(landmarks).tilt,
    wrist: landmarks[WRIST],
  };
}
