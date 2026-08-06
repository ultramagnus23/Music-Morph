// §4.4: beat position derived from the active deck's beatgrid, not a wall
// clock. Must survive seek, pause, and tempo change without drifting —
// achieved by always computing position from (playhead, firstDownbeat, bpm)
// rather than integrating a running counter.

export interface Beatgrid {
  bpm: number;
  firstDownbeatSeconds: number;
}

export class BeatClock {
  private grid: Beatgrid = { bpm: 120, firstDownbeatSeconds: 0 };

  setGrid(grid: Beatgrid): void {
    this.grid = grid;
  }

  get bpm(): number {
    return this.grid.bpm;
  }

  beatPosition(playheadSeconds: number): number {
    return (playheadSeconds - this.grid.firstDownbeatSeconds) * (this.grid.bpm / 60);
  }

  barPosition(playheadSeconds: number): number {
    return this.beatPosition(playheadSeconds) / 4;
  }

  secondsPerBeat(): number {
    return 60 / this.grid.bpm;
  }

  /** Seconds until the next grid line at the given quantization (in beats,
   * e.g. 0.25 for a 1/16 grid relative to a 1-beat unit — pass 1 for
   * quarter-note quantization). Used to schedule quantized triggers, §3.8. */
  secondsUntilNextGridLine(playheadSeconds: number, quantizeBeats: number): number {
    const beat = this.beatPosition(playheadSeconds);
    const nextGridBeat = Math.ceil(beat / quantizeBeats) * quantizeBeats;
    const beatsUntil = nextGridBeat - beat;
    return beatsUntil * this.secondsPerBeat();
  }
}
