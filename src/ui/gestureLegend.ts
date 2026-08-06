// Always-available gesture cheat sheet — directly answers "I can't
// remember what each shape does." Renders DEFAULT_GESTURE_MAP (the single
// source of truth also used by GestureEffectRouter) so it can never drift
// out of sync with what the app actually does.

import { DEFAULT_GESTURE_MAP } from "../audio/gestureEffectMap";
import type { Posture } from "../vision/postureClassifier";

const POSTURE_GLYPH: Record<Posture, string> = {
  NEUTRAL: "🖐",
  FIST: "✊",
  POINT: "☝",
  PEACE: "✌",
  HORNS: "🤟",
  THUMB: "👍",
  UNKNOWN: "?",
};

const POSTURE_ORDER: Posture[] = ["FIST", "POINT", "PEACE", "HORNS", "THUMB"];

export function renderGestureLegend(container: HTMLElement): void {
  const columns = (["left", "right"] as const)
    .map((hand) => {
      const rows = POSTURE_ORDER.map((posture) => {
        const mapping = DEFAULT_GESTURE_MAP[hand][posture];
        if (!mapping) return "";
        return `
          <div class="legend-row">
            <span class="legend-glyph">${POSTURE_GLYPH[posture]}</span>
            <span class="legend-effect">${mapping.slot}</span>
          </div>
        `;
      }).join("");

      return `
        <div class="legend-column legend-column--${hand}">
          <div class="legend-heading">${hand === "left" ? "Left hand" : "Right hand"}</div>
          ${rows}
        </div>
      `;
    })
    .join("");

  container.innerHTML = columns;
}
