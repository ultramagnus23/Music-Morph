// Live per-hand diagnostic readout: raw (pre-hysteresis) posture, the
// debounced/active posture, lifecycle state, and pinch. Toggled on with the
// same control that opens the gesture legend. Exists so gesture-recognition
// complaints can be reported precisely ("raw posture flickers between POINT
// and UNKNOWN" is fixable; "hand recognition isn't good" isn't) instead of
// guessed at blind.

import type { TrackerFrame } from "../vision/handTracker";

export class DebugReadout {
  constructor(private el: HTMLElement) {}

  update(frame: TrackerFrame): void {
    const rows = (["left", "right"] as const)
      .map((id) => {
        const hand = frame.hands.find((h) => h.id === id);
        if (!hand) return `<div class="debug-row">${id}: not visible</div>`;
        return `
          <div class="debug-row">
            <span class="debug-hand">${id}</span>
            <span class="hud-value">raw ${hand.rawPosture}</span>
            <span class="hud-value">state ${hand.lifecycle.state}</span>
            <span class="hud-value">active ${hand.lifecycle.activePosture ?? "-"}</span>
            <span class="hud-value">pinch ${(hand.pinch * 100).toFixed(0)}%</span>
          </div>
        `;
      })
      .join("");

    this.el.innerHTML = `<div class="debug-row">fps ${frame.fps.toFixed(0)} · confidence ${(frame.confidence * 100).toFixed(0)}%</div>${rows}`;
  }
}
