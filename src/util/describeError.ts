// Turns any thrown/rejected value into a readable string. Needed because
// not everything that can reject a promise is an Error: DOMException isn't
// reliably `instanceof Error` across engines, and MediaPipe's WASM/worker
// loading path can reject with a raw ErrorEvent/Event when a worker or
// WebGL context fails to initialize (which is exactly what produced the
// unhelpful "[object Event]" status message this replaces).
export function describeError(err: unknown): string {
  if (err instanceof Error) return err.message;

  if (typeof ErrorEvent !== "undefined" && err instanceof ErrorEvent) {
    return err.message || `${err.type} (${err.filename ?? "unknown source"}:${err.lineno ?? "?"})`;
  }

  if (typeof Event !== "undefined" && err instanceof Event) {
    const target = err.target as { message?: string; error?: unknown; src?: string } | null;
    return target?.message ?? `${err.type} event${target?.src ? ` on ${target.src}` : ""}`;
  }

  if (typeof DOMException !== "undefined" && err instanceof DOMException) {
    return `${err.name}: ${err.message}`;
  }

  if (typeof err === "string") return err;

  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}
