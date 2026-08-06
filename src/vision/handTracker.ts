// MediaPipe Tasks Vision wiring. Runs the HandLandmarker on webcam frames,
// smooths landmarks (One-Euro), extracts features, classifies posture, and
// drives each hand's state machine. Emits normalized control events onto
// the control bus at camera framerate (target 60fps, §5 latency budget).
//
// TODO(Phase 1): this file is the "prove the loop" spike target. Get this
// wired to one filter param before building anything else — see spec §9.

import { FilesetResolver, HandLandmarker, type HandLandmarkerResult } from "@mediapipe/tasks-vision";
import { HandLandmarkFilter, DEFAULT_ONE_EURO_PARAMS, type OneEuroParams } from "./oneEuroFilter";
import { extractHandFeatures } from "./featureExtraction";
import { classifyPosture, type Posture } from "./postureClassifier";
import { HandStateMachine, DEFAULT_HAND_STATE_CONFIG, type HandStateMachineOutput } from "./handStateMachine";
import { HandIdentityTracker, type HandId } from "./handIdentity";
import type { RawHandDetection, Vec3 } from "./landmarks";
import { describeError } from "../util/describeError";

export interface HandFrame {
  id: HandId;
  lifecycle: HandStateMachineOutput;
  pinch: number;
  tilt: number;
  wrist: Vec3; // normalized [x, y, z], mirrored for display upstream
  scale: number;
  /** All 21 smoothed landmarks, for drawing the full skeleton (§7.3). Empty
   * when the hand isn't present this frame. */
  landmarks: Vec3[];
  /** This frame's instantaneous classification, before the state machine's
   * hysteresis/debounce. Diagnostic only — HudPanel/GestureEffectRouter use
   * `lifecycle.activePosture` instead. Exposed so a debug overlay can show
   * exactly what the classifier sees frame-to-frame. */
  rawPosture: Posture;
}

export interface TrackerFrame {
  timestampMs: number;
  hands: HandFrame[];
  fps: number;
  confidence: number; // 0-1, drives the confidence bar (§7.3, §8)
}

export type TrackerFrameListener = (frame: TrackerFrame) => void;

const MODEL_ASSET_PATH =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";
const WASM_BASE_PATH = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm";

export class HandTracker {
  private landmarker: HandLandmarker | null = null;
  private video: HTMLVideoElement | null = null;
  private rafId: number | null = null;
  private lastTimestampMs = -1;
  private fpsEma = 60;

  private readonly filters = new Map<HandId, HandLandmarkFilter>([
    ["left", new HandLandmarkFilter()],
    ["right", new HandLandmarkFilter()],
  ]);
  private readonly stateMachines = new Map<HandId, HandStateMachine>([
    ["left", new HandStateMachine(DEFAULT_HAND_STATE_CONFIG)],
    ["right", new HandStateMachine(DEFAULT_HAND_STATE_CONFIG)],
  ]);
  private readonly identity = new HandIdentityTracker();

  private listeners = new Set<TrackerFrameListener>();

  async init(): Promise<void> {
    let vision: Awaited<ReturnType<typeof FilesetResolver.forVisionTasks>>;
    try {
      vision = await FilesetResolver.forVisionTasks(WASM_BASE_PATH);
    } catch (err) {
      throw new Error(`Could not load the hand-tracking WASM runtime: ${describeError(err)}`);
    }

    const options = {
      runningMode: "VIDEO" as const,
      numHands: 2,
      minHandDetectionConfidence: 0.6,
      minHandPresenceConfidence: 0.6,
      minTrackingConfidence: 0.6,
    };

    // GPU delegate needs a working WebGL context, which is the most
    // failure-prone part of MediaPipe init inside a sandboxed Electron
    // renderer (ANGLE/driver quirks, GPU process crashes). It can reject
    // with a raw Event rather than an Error when the underlying WebGL
    // context creation fails, which is why describeError exists. Fall back
    // to the CPU delegate rather than leaving the performer with a dead app.
    try {
      this.landmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: MODEL_ASSET_PATH, delegate: "GPU" },
        ...options,
      });
    } catch (gpuErr) {
      console.warn(`GPU delegate failed (${describeError(gpuErr)}), falling back to CPU delegate.`);
      try {
        this.landmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: MODEL_ASSET_PATH, delegate: "CPU" },
          ...options,
        });
      } catch (cpuErr) {
        throw new Error(`Could not initialize hand tracking (tried GPU and CPU): ${describeError(cpuErr)}`);
      }
    }
  }

  setOneEuroParams(params: OneEuroParams = DEFAULT_ONE_EURO_PARAMS): void {
    for (const f of this.filters.values()) f.setParams(params);
  }

  onFrame(listener: TrackerFrameListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  start(video: HTMLVideoElement): void {
    if (!this.landmarker) throw new Error("HandTracker.init() must resolve before start()");
    this.video = video;
    const loop = () => {
      this.tick();
      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  stop(): void {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.rafId = null;
  }

  private tick(): void {
    if (!this.landmarker || !this.video) return;
    const nowMs = performance.now();
    if (nowMs === this.lastTimestampMs) return; // duplicate frame

    const result: HandLandmarkerResult = this.landmarker.detectForVideo(this.video, nowMs);

    const dt = this.lastTimestampMs < 0 ? 1 / 60 : (nowMs - this.lastTimestampMs) / 1000;
    this.fpsEma = this.fpsEma * 0.9 + (1 / Math.max(dt, 1e-3)) * 0.1;
    this.lastTimestampMs = nowMs;

    const detections: RawHandDetection[] = result.landmarks.map((landmarks, i) => ({
      landmarks: landmarks.map((p): Vec3 => [p.x, p.y, p.z]),
      handedness: (result.handedness[i]?.[0]?.categoryName as "Left" | "Right") ?? "Right",
      handednessScore: result.handedness[i]?.[0]?.score ?? 0,
    }));

    const assigned = this.identity.assign(detections);
    const tSeconds = nowMs / 1000;
    const hands: HandFrame[] = [];

    for (const id of ["left", "right"] as HandId[]) {
      const detection = assigned.get(id);
      const filter = this.filters.get(id)!;
      const stateMachine = this.stateMachines.get(id)!;

      if (!detection) {
        const lifecycle = stateMachine.step({
          posture: "UNKNOWN",
          pinch: 0,
          wristY: 0.5,
          handPresent: false,
          nowMs,
        });
        if (lifecycle.state !== "IDLE") {
          hands.push({ id, lifecycle, pinch: 0, tilt: 0, wrist: [0.5, 0.5, 0], scale: 0, landmarks: [], rawPosture: "UNKNOWN" });
        }
        continue;
      }

      const smoothed = filter.filter(detection.landmarks, tSeconds);
      const features = extractHandFeatures(smoothed);
      const posture = classifyPosture(features);
      const lifecycle = stateMachine.step({
        posture,
        pinch: features.pinch,
        wristY: features.wrist[1],
        handPresent: true,
        nowMs,
      });

      hands.push({
        id,
        lifecycle,
        pinch: features.pinch,
        tilt: features.tilt,
        wrist: features.wrist,
        scale: features.scale,
        landmarks: smoothed,
        rawPosture: posture,
      });
    }

    const confidence = detections.length === 0 ? 0 : Math.min(1, this.fpsEma / 30);

    const frame: TrackerFrame = { timestampMs: nowMs, hands, fps: this.fpsEma, confidence };
    for (const listener of this.listeners) listener(frame);
  }
}
