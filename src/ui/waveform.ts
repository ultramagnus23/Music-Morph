// Waveform strip, §7.3: full-track waveform, beat ticks every bar, heavier
// tick every 8 bars (phrase), playhead, mix-out marker. The one UI element
// allowed to be small — it earns it.

import type { BeatClock } from "../audio/beatClock";

export class WaveformStrip {
  private ctx: CanvasRenderingContext2D;
  private peaks: Float32Array | null = null;
  private durationSeconds = 0;

  constructor(private canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2D canvas context unavailable");
    this.ctx = ctx;
  }

  loadBuffer(buffer: AudioBuffer): void {
    const width = Math.max(1, this.canvas.width);
    const channel = buffer.getChannelData(0);
    const samplesPerPixel = Math.max(1, Math.floor(channel.length / width));
    const peaks = new Float32Array(width);
    for (let x = 0; x < width; x++) {
      let max = 0;
      const start = x * samplesPerPixel;
      const end = Math.min(channel.length, start + samplesPerPixel);
      for (let i = start; i < end; i++) max = Math.max(max, Math.abs(channel[i]));
      peaks[x] = max;
    }
    this.peaks = peaks;
    this.durationSeconds = buffer.duration;
  }

  draw(beatClock: BeatClock, playheadSeconds: number, mixOutSeconds: number | null): void {
    const { ctx, canvas } = this;
    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);
    if (!this.peaks || this.durationSeconds === 0) return;

    const mid = height / 2;
    ctx.fillStyle = "oklch(0.68 0.02 80 / 0.5)"; // --fg-secondary
    for (let x = 0; x < width; x++) {
      const amp = this.peaks[x] * mid;
      ctx.fillRect(x, mid - amp, 1, amp * 2);
    }

    // Beat ticks: heavier every 8 bars (phrase boundary).
    const secondsPerBeat = beatClock.secondsPerBeat();
    const totalBeats = Math.floor(this.durationSeconds / secondsPerBeat);
    for (let beat = 0; beat < totalBeats; beat++) {
      const t = beat * secondsPerBeat;
      const x = (t / this.durationSeconds) * width;
      const isPhraseBoundary = beat % 32 === 0; // 8 bars * 4 beats
      // Phrase ticks: --fg-primary. Beat ticks: --hairline.
      ctx.strokeStyle = isPhraseBoundary ? "oklch(0.95 0.015 80)" : "oklch(0.95 0.015 80 / 0.09)";
      ctx.lineWidth = isPhraseBoundary ? 2 : 1;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    if (mixOutSeconds !== null) {
      const x = (mixOutSeconds / this.durationSeconds) * width;
      ctx.fillStyle = "oklch(0.78 0.16 55)"; // --accent-right
      ctx.beginPath();
      ctx.moveTo(x - 5, 0);
      ctx.lineTo(x + 5, 0);
      ctx.lineTo(x, 10);
      ctx.closePath();
      ctx.fill();
    }

    const playheadX = (playheadSeconds / this.durationSeconds) * width;
    ctx.strokeStyle = "oklch(0.95 0.015 80)"; // --fg-primary
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(playheadX, 0);
    ctx.lineTo(playheadX, height);
    ctx.stroke();
  }
}
