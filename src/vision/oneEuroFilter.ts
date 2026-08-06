// One-Euro filter (Casiez, Roussel, Vogel 2012). Adapts smoothing to speed:
// heavy smoothing when a signal is slow (kills jitter), light smoothing when
// it's fast (kills lag). Used on every raw landmark coordinate before any
// derived feature (posture, pinch, etc.) is computed — see §3.4: "Never
// smooth the derived discrete state."

export interface OneEuroParams {
  minCutoff: number;
  beta: number;
  dCutoff: number;
}

export const DEFAULT_ONE_EURO_PARAMS: OneEuroParams = {
  minCutoff: 1.0,
  beta: 0.007,
  dCutoff: 1.0,
};

function smoothingFactor(rate: number, cutoff: number): number {
  const r = 2 * Math.PI * cutoff;
  return r / (r + rate);
}

function exponentialSmoothing(a: number, x: number, xPrev: number): number {
  return a * x + (1 - a) * xPrev;
}

/** A single scalar One-Euro filter. Compose three (x, y, z) for a landmark. */
export class OneEuroFilter1D {
  private xPrev: number | null = null;
  private dxPrev = 0;
  private tPrev: number | null = null;

  constructor(private params: OneEuroParams = DEFAULT_ONE_EURO_PARAMS) {}

  setParams(params: OneEuroParams): void {
    this.params = params;
  }

  reset(): void {
    this.xPrev = null;
    this.dxPrev = 0;
    this.tPrev = null;
  }

  /** @param tSeconds monotonic timestamp in seconds (e.g. performance.now() / 1000) */
  filter(x: number, tSeconds: number): number {
    if (this.xPrev === null || this.tPrev === null) {
      this.xPrev = x;
      this.tPrev = tSeconds;
      return x;
    }

    const dt = Math.max(tSeconds - this.tPrev, 1e-6);
    const rate = 1 / dt;

    const dx = (x - this.xPrev) * rate;
    const aD = smoothingFactor(rate, this.params.dCutoff);
    const dxHat = exponentialSmoothing(aD, dx, this.dxPrev);

    const cutoff = this.params.minCutoff + this.params.beta * Math.abs(dxHat);
    const a = smoothingFactor(rate, cutoff);
    const xHat = exponentialSmoothing(a, x, this.xPrev);

    this.xPrev = xHat;
    this.dxPrev = dxHat;
    this.tPrev = tSeconds;
    return xHat;
  }
}

/** Filters a 3D point (x, y, z) with three independent 1D filters. */
export class OneEuroFilter3D {
  private fx: OneEuroFilter1D;
  private fy: OneEuroFilter1D;
  private fz: OneEuroFilter1D;

  constructor(params: OneEuroParams = DEFAULT_ONE_EURO_PARAMS) {
    this.fx = new OneEuroFilter1D(params);
    this.fy = new OneEuroFilter1D(params);
    this.fz = new OneEuroFilter1D(params);
  }

  setParams(params: OneEuroParams): void {
    this.fx.setParams(params);
    this.fy.setParams(params);
    this.fz.setParams(params);
  }

  reset(): void {
    this.fx.reset();
    this.fy.reset();
    this.fz.reset();
  }

  filter(point: [number, number, number], tSeconds: number): [number, number, number] {
    return [
      this.fx.filter(point[0], tSeconds),
      this.fy.filter(point[1], tSeconds),
      this.fz.filter(point[2], tSeconds),
    ];
  }
}

/** 21 independent 3D filters, one per MediaPipe hand landmark. */
export class HandLandmarkFilter {
  private filters: OneEuroFilter3D[];

  constructor(params: OneEuroParams = DEFAULT_ONE_EURO_PARAMS) {
    this.filters = Array.from({ length: 21 }, () => new OneEuroFilter3D(params));
  }

  setParams(params: OneEuroParams): void {
    for (const f of this.filters) f.setParams(params);
  }

  reset(): void {
    for (const f of this.filters) f.reset();
  }

  /** @param landmarks 21 raw [x, y, z] points from MediaPipe, normalized 0-1 */
  filter(landmarks: [number, number, number][], tSeconds: number): [number, number, number][] {
    return landmarks.map((p, i) => this.filters[i].filter(p, tSeconds));
  }
}
