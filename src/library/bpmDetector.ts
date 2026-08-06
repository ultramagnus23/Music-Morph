// Client-side BPM/beatgrid detection — no Python/Essentia dependency.
// Essentia (the spec's §6.1 pick) has no Windows wheel; installing it means
// compiling from source against fftw/ffmpeg/taglib, which isn't realistic
// to expect on an arbitrary machine. This runs entirely in the renderer
// against an already-decoded AudioBuffer, so "load a track" gets a real
// BPM with zero extra installs. It does not detect musical key — that
// genuinely does need a proper audio-analysis library; BPM is what "queue
// similar-tempo songs" actually depends on, so it's the priority.
//
// Algorithm (classic energy-based beat detection, not full onset-detection-
// function/autocorrelation-of-spectral-flux sophistication, but reliable
// for the steady 4/4 dance-music case this product targets):
//   1. Mono-sum and downsample for speed.
//   2. Sliding-window RMS envelope (~11.6ms hops).
//   3. Onset strength = positive half-wave rectified derivative of the
//      envelope (an increase in energy = a likely onset).
//   4. Autocorrelate the onset envelope across the 60-190 BPM lag range;
//      the lag with peak correlation is the beat period.
//   5. First downbeat = the position of the strongest onset peak inside
//      the first few beat periods.

export interface DetectedBeatgrid {
  bpm: number;
  firstDownbeatSeconds: number;
  confidence: number; // 0-1, autocorrelation peak sharpness
}

const ANALYSIS_SAMPLE_RATE = 11025; // plenty for tempo detection, keeps this fast
const HOP_SIZE = 128; // ~11.6ms at 11025Hz
const MIN_BPM = 60;
const MAX_BPM = 190;
const MAX_ANALYSIS_SECONDS = 90; // steady-tempo dance tracks don't need the whole file

function downmixAndDownsample(buffer: AudioBuffer): Float32Array {
  const channels = buffer.numberOfChannels;
  const sourceRate = buffer.sampleRate;
  const durationSeconds = Math.min(buffer.duration, MAX_ANALYSIS_SECONDS);
  const sourceLength = Math.floor(durationSeconds * sourceRate);
  const ratio = sourceRate / ANALYSIS_SAMPLE_RATE;
  const outLength = Math.floor(sourceLength / ratio);
  const out = new Float32Array(outLength);

  const channelData: Float32Array[] = [];
  for (let c = 0; c < channels; c++) channelData.push(buffer.getChannelData(c));

  for (let i = 0; i < outLength; i++) {
    const sourceIndex = Math.floor(i * ratio);
    let sum = 0;
    for (let c = 0; c < channels; c++) sum += channelData[c][sourceIndex] ?? 0;
    out[i] = sum / channels;
  }
  return out;
}

function computeEnergyEnvelope(samples: Float32Array): Float32Array {
  const hops = Math.floor(samples.length / HOP_SIZE);
  const envelope = new Float32Array(hops);
  for (let h = 0; h < hops; h++) {
    let sumSquares = 0;
    const start = h * HOP_SIZE;
    for (let i = 0; i < HOP_SIZE; i++) {
      const s = samples[start + i] ?? 0;
      sumSquares += s * s;
    }
    envelope[h] = Math.sqrt(sumSquares / HOP_SIZE);
  }
  return envelope;
}

function onsetStrength(envelope: Float32Array): Float32Array {
  const onset = new Float32Array(envelope.length);
  for (let i = 1; i < envelope.length; i++) {
    onset[i] = Math.max(0, envelope[i] - envelope[i - 1]);
  }
  return onset;
}

function autocorrelate(signal: Float32Array, minLag: number, maxLag: number): { lag: number; strength: number } {
  let bestLag = minLag;
  let bestScore = -Infinity;
  const scores = new Float32Array(maxLag - minLag + 1);

  for (let lag = minLag; lag <= maxLag; lag++) {
    let sum = 0;
    for (let i = 0; i + lag < signal.length; i++) {
      sum += signal[i] * signal[i + lag];
    }
    const score = sum / (signal.length - lag);
    scores[lag - minLag] = score;
    if (score > bestScore) {
      bestScore = score;
      bestLag = lag;
    }
  }

  // Confidence: how much the winning lag stands out from the mean —
  // a flat autocorrelation (no clear periodicity) means low confidence.
  let mean = 0;
  for (const s of scores) mean += s;
  mean /= scores.length;
  const confidence = mean > 0 ? Math.min(1, Math.max(0, (bestScore - mean) / (bestScore || 1))) : 0;

  return { lag: bestLag, strength: confidence };
}

function findFirstDownbeat(onset: Float32Array, beatPeriodHops: number, hopSeconds: number): number {
  const searchWindow = Math.min(onset.length, beatPeriodHops * 4);
  let bestIndex = 0;
  let bestValue = -Infinity;
  for (let i = 0; i < searchWindow; i++) {
    if (onset[i] > bestValue) {
      bestValue = onset[i];
      bestIndex = i;
    }
  }
  return bestIndex * hopSeconds;
}

export function detectBeatgrid(buffer: AudioBuffer): DetectedBeatgrid {
  const samples = downmixAndDownsample(buffer);
  const envelope = computeEnergyEnvelope(samples);
  const onset = onsetStrength(envelope);

  const hopSeconds = HOP_SIZE / ANALYSIS_SAMPLE_RATE;
  const minLag = Math.floor(60 / MAX_BPM / hopSeconds);
  const maxLag = Math.ceil(60 / MIN_BPM / hopSeconds);

  const { lag, strength } = autocorrelate(onset, minLag, maxLag);
  const periodSeconds = lag * hopSeconds;
  const bpm = 60 / periodSeconds;

  const firstDownbeatSeconds = findFirstDownbeat(onset, lag, hopSeconds);

  return { bpm, firstDownbeatSeconds, confidence: strength };
}
