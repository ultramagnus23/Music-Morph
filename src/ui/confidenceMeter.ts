// Segmented tracking-confidence meter, DESIGN.md §5: a row of discrete
// ticks (like a VU meter) rather than a continuous gradient bar — it reads
// as a measurement, not decoration. §8: the performer must know instantly
// when tracking degrades, since a dropped hand otherwise feels like a
// broken app rather than a lighting/framing problem.

const SEGMENT_COUNT = 12;
const DEGRADED_THRESHOLD = 0.5;

export class ConfidenceMeter {
  private ticks: HTMLDivElement[];

  constructor(container: HTMLElement) {
    this.ticks = Array.from({ length: SEGMENT_COUNT }, () => {
      const tick = document.createElement("div");
      tick.className = "confidence-tick";
      container.appendChild(tick);
      return tick;
    });
  }

  update(confidence: number): void {
    const lit = Math.round(Math.min(1, Math.max(0, confidence)) * SEGMENT_COUNT);
    const degraded = confidence < DEGRADED_THRESHOLD;
    this.ticks.forEach((tick, i) => {
      tick.classList.toggle("is-lit", i < lit);
      tick.classList.toggle("is-degraded", degraded);
    });
  }
}
