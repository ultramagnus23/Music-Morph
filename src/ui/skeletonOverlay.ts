// Renders the 21-point hand skeleton, §7.3: "dimmed when IDLE, full
// brightness when ENGAGED. The transition from armed to engaged should be
// visually unmistakable, since it is the moment sound changes." Drawn at
// full framerate with minimal smoothing even though audio params are
// heavily smoothed — seeing your hand respond instantly makes the audio
// feel faster than it is (§5, "a genuine perceptual trick").

import type { TrackerFrame } from "../vision/handTracker";
import type { Vec3 } from "../vision/landmarks";

// MediaPipe hand landmark connections (wrist/palm + four fingers + thumb).
const CONNECTIONS: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4], // thumb
  [0, 5], [5, 6], [6, 7], [7, 8], // index
  [5, 9], [9, 10], [10, 11], [11, 12], // middle
  [9, 13], [13, 14], [14, 15], [15, 16], // ring
  [13, 17], [17, 18], [18, 19], [19, 20], // pinky
  [0, 17], // palm base
];

export class SkeletonOverlay {
  private ctx: CanvasRenderingContext2D;

  constructor(private canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2D canvas context unavailable");
    this.ctx = ctx;
  }

  resize(width: number, height: number): void {
    this.canvas.width = width;
    this.canvas.height = height;
  }

  draw(frame: TrackerFrame): void {
    const { ctx, canvas } = this;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (const hand of frame.hands) {
      const engaged = hand.lifecycle.state === "ENGAGED";
      // Matches --accent-left / --accent-right in style.css exactly — the
      // Two-Signal Rule (DESIGN.md) requires the skeleton, HUD, and
      // parameter arcs to agree on the identical color per hand.
      const hue = hand.id === "left" ? "205" : "55";
      const lightness = hand.id === "left" ? "0.74" : "0.78";
      const chroma = hand.id === "left" ? "0.15" : "0.16";
      const alpha = engaged ? 0.95 : 0.35;
      const color = `oklch(${lightness} ${chroma} ${hue} / ${alpha})`;
      ctx.fillStyle = color;
      ctx.strokeStyle = color;
      ctx.lineWidth = engaged ? 3 : 1.5;

      const toScreen = (p: Vec3): [number, number] => [(1 - p[0]) * canvas.width, p[1] * canvas.height];

      if (hand.landmarks.length === 21) {
        for (const [a, b] of CONNECTIONS) {
          const [ax, ay] = toScreen(hand.landmarks[a]);
          const [bx, by] = toScreen(hand.landmarks[b]);
          ctx.beginPath();
          ctx.moveTo(ax, ay);
          ctx.lineTo(bx, by);
          ctx.stroke();
        }
        for (const p of hand.landmarks) {
          const [x, y] = toScreen(p);
          ctx.beginPath();
          ctx.arc(x, y, engaged ? 4 : 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
      } else {
        const [x, y] = toScreen(hand.wrist);
        ctx.beginPath();
        ctx.arc(x, y, engaged ? 10 : 6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}

export { CONNECTIONS };
