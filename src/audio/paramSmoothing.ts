// §4.3: never assign directly to an AudioParam — that produces zipper noise.
// Always ramp via setTargetAtTime. Filter cutoff (and anything else
// perceived logarithmically — delay time, frequency-ish params) should be
// interpolated in log space so the sweep feels perceptually even.

const DEFAULT_TIME_CONSTANT = 0.012; // ~12ms, per spec

export function smoothSet(param: AudioParam, target: number, ctx: BaseAudioContext, timeConstant = DEFAULT_TIME_CONSTANT): void {
  param.setTargetAtTime(target, ctx.currentTime, timeConstant);
}

/** Maps a linear 0-1 control value to a log-spaced range, e.g. filter cutoff 80Hz-20kHz. */
export function logRange(value01: number, min: number, max: number): number {
  const clamped = Math.min(1, Math.max(0, value01));
  const logMin = Math.log(min);
  const logMax = Math.log(max);
  return Math.exp(logMin + clamped * (logMax - logMin));
}

/** Inverse of logRange — useful for displaying a HUD readout from a raw Hz value. */
export function inverseLogRange(value: number, min: number, max: number): number {
  const logMin = Math.log(min);
  const logMax = Math.log(max);
  return (Math.log(Math.max(value, min)) - logMin) / (logMax - logMin);
}

export function linRange(value01: number, min: number, max: number): number {
  const clamped = Math.min(1, Math.max(0, value01));
  return min + clamped * (max - min);
}

/** Smoothly ramps a filter's cutoff in log space in one call. */
export function smoothSetLog(
  param: AudioParam,
  value01: number,
  min: number,
  max: number,
  ctx: BaseAudioContext,
  timeConstant = DEFAULT_TIME_CONSTANT,
): void {
  smoothSet(param, logRange(value01, min, max), ctx, timeConstant);
}
