// Shared types for the vision pipeline. MediaPipe HandLandmarker index
// reference: 0=wrist, 1-4=thumb (CMC,MCP,IP,TIP), 5-8=index (MCP,PIP,DIP,TIP),
// 9-12=middle, 13-16=ring, 17-20=pinky.

export type Vec3 = [number, number, number];

/** 21 landmarks, indexed per the MediaPipe hand model. Normalized image coords. */
export type HandLandmarks = Vec3[];

export type Handedness = "Left" | "Right";

export interface RawHandDetection {
  landmarks: HandLandmarks;
  handedness: Handedness;
  handednessScore: number;
}

export const FINGER_INDICES = {
  thumb: { tip: 4, ip: 3, mcp: 2, cmc: 1 },
  index: { tip: 8, pip: 6, mcp: 5 },
  middle: { tip: 12, pip: 10, mcp: 9 },
  ring: { tip: 16, pip: 14, mcp: 13 },
  pinky: { tip: 20, pip: 18, mcp: 17 },
} as const;

export const WRIST = 0;
export const MIDDLE_MCP = 9;
export const INDEX_MCP = 5;
export const PINKY_MCP = 17;
