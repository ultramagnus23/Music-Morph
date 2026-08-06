// Next-track scoring, §6.2. Pure function of (current track, candidates,
// history, session arc) — no IO, so it's cheap to unit test and to expose
// weights in a settings panel.

import type { TrackAnalysis } from "./analyzerClient";

export interface ScoringWeights {
  bpm: number;
  key: number;
  energy: number;
  novelty: number;
  taste: number;
  repeatPenalty: number;
}

export const DEFAULT_WEIGHTS: ScoringWeights = {
  bpm: 1.0,
  key: 1.0,
  energy: 0.8,
  novelty: 0.4,
  taste: 0.6,
  repeatPenalty: 1.5,
};

export type SessionArcPhase = "warmup" | "peak" | "comedown";

export interface Candidate {
  trackId: string;
  analysis: TrackAnalysis;
  lastPlayedAt: number | null; // epoch ms, null = never played
  spotifyAffinityScore: number; // 0-1, from taste signal (top tracks / recently played)
}

/** Full score within +/-3%, decaying to zero at +/-8% — the limit of clean
 * time-stretching. Also scores half-time/double-time matches (140 BPM mixes
 * into 70 BPM). */
export function bpmCompatibility(currentBpm: number, candidateBpm: number): number {
  const ratios = [1, 2, 0.5];
  let best = 0;
  for (const ratio of ratios) {
    const scaled = candidateBpm * ratio;
    const pctDiff = Math.abs(scaled - currentBpm) / currentBpm;
    let score: number;
    if (pctDiff <= 0.03) score = 1;
    else if (pctDiff >= 0.08) score = 0;
    else score = 1 - (pctDiff - 0.03) / 0.05;
    best = Math.max(best, score);
  }
  return best;
}

const CAMELOT_NUMBERS = 12;

function parseCamelot(camelot: string): { number: number; letter: "A" | "B" } | null {
  const match = /^(\d{1,2})([AB])$/i.exec(camelot.trim());
  if (!match) return null;
  return { number: parseInt(match[1], 10), letter: match[2].toUpperCase() as "A" | "B" };
}

/** Standard harmonic mixing (Camelot wheel), §6.2. */
export function camelotCompatibility(current: string, candidate: string): number {
  const a = parseCamelot(current);
  const b = parseCamelot(candidate);
  if (!a || !b) return 0.2;

  if (a.number === b.number && a.letter === b.letter) return 1.0;
  if (a.number === b.number && a.letter !== b.letter) return 0.9; // relative major/minor

  const diff = Math.min((a.number - b.number + CAMELOT_NUMBERS) % CAMELOT_NUMBERS, (b.number - a.number + CAMELOT_NUMBERS) % CAMELOT_NUMBERS);
  if (diff === 1 && a.letter === b.letter) return 0.9;
  if (diff === 7 && a.letter === b.letter) return 0.7; // "energy boost"
  return 0.2;
}

function trackEnergy(analysis: TrackAnalysis): number {
  if (analysis.energyCurve.length === 0) return 0.5;
  const sum = analysis.energyCurve.reduce((a, b) => a + b, 0);
  return sum / analysis.energyCurve.length;
}

/** Targets the next track's energy at current +/- 0.15, biased by the
 * session arc's direction. */
export function energyContinuity(currentEnergy: number, candidateEnergy: number, arc: SessionArcPhase): number {
  const bias = arc === "warmup" ? 0.1 : arc === "comedown" ? -0.1 : 0;
  const target = Math.min(1, Math.max(0, currentEnergy + bias));
  const diff = Math.abs(candidateEnergy - target);
  return Math.max(0, 1 - diff / 0.4);
}

export function noveltyScore(lastPlayedAt: number | null, now: number): number {
  if (lastPlayedAt === null) return 1;
  const daysSince = (now - lastPlayedAt) / (1000 * 60 * 60 * 24);
  return Math.min(1, daysSince / 30);
}

export function recentlyPlayedPenalty(lastPlayedAt: number | null, now: number, sessionWindowMs: number): number {
  if (lastPlayedAt === null) return 0;
  const elapsed = now - lastPlayedAt;
  if (elapsed >= sessionWindowMs) return 0;
  return 1 - elapsed / sessionWindowMs;
}

export interface ScoreContext {
  currentBpm: number;
  currentCamelot: string;
  currentEnergy: number;
  sessionArc: SessionArcPhase;
  now: number;
  sessionWindowMs: number; // e.g. last 2 hours counts as "recently played"
}

export function scoreCandidate(candidate: Candidate, ctx: ScoreContext, weights: ScoringWeights = DEFAULT_WEIGHTS): number {
  const bpm = bpmCompatibility(ctx.currentBpm, candidate.analysis.bpm);
  const key = camelotCompatibility(ctx.currentCamelot, candidate.analysis.camelot);
  const energy = energyContinuity(ctx.currentEnergy, trackEnergy(candidate.analysis), ctx.sessionArc);
  const novelty = noveltyScore(candidate.lastPlayedAt, ctx.now);
  const taste = candidate.spotifyAffinityScore;
  const repeatPenalty = recentlyPlayedPenalty(candidate.lastPlayedAt, ctx.now, ctx.sessionWindowMs);

  return (
    weights.bpm * bpm +
    weights.key * key +
    weights.energy * energy +
    weights.novelty * novelty +
    weights.taste * taste -
    weights.repeatPenalty * repeatPenalty
  );
}

export function rankCandidates(candidates: Candidate[], ctx: ScoreContext, weights: ScoringWeights = DEFAULT_WEIGHTS): Candidate[] {
  return [...candidates].sort((a, b) => scoreCandidate(b, ctx, weights) - scoreCandidate(a, ctx, weights));
}
