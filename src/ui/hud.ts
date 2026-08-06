// Wrist-anchored HUD, the signature component (DESIGN.md §5). Follows the
// wrist so the performer's eyes never leave their hands. Opacity/border
// snap instantly between armed (55%, dim signal border) and engaged (100%,
// full signal border) — that snap is the single most important motion
// event in the app, so it must never ease slowly.

import type { HandFrame } from "../vision/handTracker";
import { DEFAULT_GESTURE_MAP } from "../audio/gestureEffectMap";
import type { HandId } from "../vision/handIdentity";

export class HudPanel {
  constructor(private el: HTMLElement) {}

  update(hand: HandFrame | undefined, canvasWidth: number, canvasHeight: number): void {
    if (!hand || hand.lifecycle.state === "IDLE") {
      this.el.classList.remove("is-armed", "is-engaged");
      return;
    }

    const x = (1 - hand.wrist[0]) * canvasWidth;
    const y = hand.wrist[1] * canvasHeight;
    this.el.style.left = `${x}px`;
    this.el.style.top = `${y}px`;

    const engaged = hand.lifecycle.state === "ENGAGED";
    this.el.classList.toggle("is-engaged", engaged);
    this.el.classList.toggle("is-armed", !engaged);

    const mapping = hand.lifecycle.activePosture
      ? DEFAULT_GESTURE_MAP[hand.id as HandId][hand.lifecycle.activePosture]
      : undefined;
    const title = mapping?.slot ?? hand.lifecycle.activePosture ?? "";

    this.el.innerHTML = `
      <div class="hud-title">${title}</div>
      <div class="hud-row">
        <span class="hud-label">Pinch</span>
        <span class="hud-value">${(hand.pinch * 100).toFixed(0)}%</span>
      </div>
    `;
  }
}
