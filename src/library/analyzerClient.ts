// Renderer-side wrapper for the offline analysis pipeline, §6.1. Actual
// analysis runs out-of-process (electron/analyzerBridge.ts spawns
// sidecar/analyze.py); this just gives the renderer a typed promise and a
// place to cache in-flight requests so importing a big library doesn't spawn
// the same track twice.

export interface TrackAnalysis {
  bpm: number;
  beatPositionsSeconds: number[];
  firstDownbeatSeconds: number;
  key: string;
  camelot: string;
  energyCurve: number[];
  sections: { type: string; startSeconds: number }[];
  cueInSeconds: number;
  cueOutSeconds: number;
  integratedLufs: number;
}

const inFlight = new Map<string, Promise<TrackAnalysis>>();

export function analyzeTrack(filePath: string): Promise<TrackAnalysis> {
  const existing = inFlight.get(filePath);
  if (existing) return existing;

  const promise = (window.handshake.sidecar.analyzeTrack(filePath) as Promise<TrackAnalysis>).finally(() =>
    inFlight.delete(filePath),
  );
  inFlight.set(filePath, promise);
  return promise;
}

/** Analyzes a batch with limited concurrency so we don't spawn N Python
 * processes at once on library import (§6.1: "run in a background worker
 * pool... show progress, never block playback"). */
export async function analyzeLibrary(
  filePaths: string[],
  concurrency: number,
  onProgress: (done: number, total: number) => void,
): Promise<Map<string, TrackAnalysis | Error>> {
  const results = new Map<string, TrackAnalysis | Error>();
  let cursor = 0;
  let done = 0;

  async function worker(): Promise<void> {
    while (cursor < filePaths.length) {
      const filePath = filePaths[cursor++];
      try {
        results.set(filePath, await analyzeTrack(filePath));
      } catch (err) {
        results.set(filePath, err instanceof Error ? err : new Error(String(err)));
      }
      done++;
      onProgress(done, filePaths.length);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, filePaths.length) }, worker));
  return results;
}
