#!/usr/bin/env python3
"""Offline track analyzer, spec §6.1. Invoked by electron/analyzerBridge.ts
as a one-shot subprocess per track:

    python analyze.py --file /path/to/track.flac

Prints a single JSON object to stdout matching the AnalysisResult shape in
electron/analyzerBridge.ts (camelCase keys) and exits non-zero with a
stderr message on failure. No stdin protocol yet — one process per track is
fine at "a few hundred tracks" library scale; batch mode can be added if
import time on large libraries becomes a problem.

Cost: roughly 5-15s per track on a laptop (§6.1). The caller
(src/library/analyzerClient.ts) runs a bounded worker pool rather than
spawning the whole library at once.
"""

import argparse
import json
import sys

import numpy as np

try:
    import essentia.standard as es
except ImportError as exc:  # pragma: no cover - environment problem, not a code bug
    print(
        f"essentia is not installed ({exc}). Run: pip install -r sidecar/requirements.txt",
        file=sys.stderr,
    )
    sys.exit(1)

try:
    import pyloudnorm as pyln
except ImportError as exc:
    print(
        f"pyloudnorm is not installed ({exc}). Run: pip install -r sidecar/requirements.txt",
        file=sys.stderr,
    )
    sys.exit(1)

# Camelot wheel lookup. Essentia's KeyExtractor returns (key, scale, strength)
# e.g. ("A", "minor", 0.87) -> camelot "8A".
_CAMELOT_MAJOR = {
    "B": "1B", "F#": "2B", "Db": "3B", "Ab": "4B", "Eb": "5B", "Bb": "6B",
    "F": "7B", "C": "8B", "G": "9B", "D": "10B", "A": "11B", "E": "12B",
}
_CAMELOT_MINOR = {
    "Ab": "1A", "Eb": "2A", "Bb": "3A", "F": "4A", "C": "5A", "G": "6A",
    "D": "7A", "A": "8A", "E": "9A", "B": "10A", "F#": "11A", "Db": "12A",
}
_ENHARMONIC = {"C#": "Db", "D#": "Eb", "G#": "Ab", "A#": "Bb", "Gb": "F#"}


def to_camelot(key: str, scale: str) -> str:
    key = _ENHARMONIC.get(key, key)
    table = _CAMELOT_MAJOR if scale == "major" else _CAMELOT_MINOR
    return table.get(key, "")


def energy_curve(audio: np.ndarray, sample_rate: int, window_seconds: float = 1.0) -> list:
    """RMS in fixed windows, smoothed. §6.1: "For finding drops and picking
    mix-out points." Not loudness-weighted — this is a shape signal, not a
    perceptual measurement (that's integrated_lufs's job)."""
    window = int(sample_rate * window_seconds)
    if window <= 0 or len(audio) == 0:
        return []
    n_windows = max(1, len(audio) // window)
    values = []
    for i in range(n_windows):
        chunk = audio[i * window : (i + 1) * window]
        if len(chunk) == 0:
            continue
        rms = float(np.sqrt(np.mean(chunk.astype(np.float64) ** 2)))
        values.append(rms)
    peak = max(values) if values else 1.0
    peak = peak or 1.0
    smoothed = []
    alpha = 0.3
    prev = values[0] if values else 0.0
    for v in values:
        prev = alpha * v + (1 - alpha) * prev
        smoothed.append(min(1.0, prev / peak))
    return smoothed


def find_sections(energy: list, min_gap_windows: int = 8) -> list:
    """Cheap novelty-curve segmentation: flags windows where energy changes
    sharply as section boundaries. §6.1 calls for SBic or a real novelty
    curve; this is a placeholder that's good enough to seed manual review in
    the library view, not a claim of accurate structural analysis.

    TODO: replace with madmom or a proper self-similarity-matrix novelty
    curve if section labels need to be trustworthy rather than a starting
    point for the user to correct.
    """
    if len(energy) < 2:
        return [{"type": "unknown", "startSeconds": 0.0}]

    sections = [{"type": "intro", "startSeconds": 0.0}]
    last_boundary = 0
    for i in range(1, len(energy)):
        if i - last_boundary < min_gap_windows:
            continue
        delta = energy[i] - energy[i - 1]
        if delta > 0.35:
            sections.append({"type": "build", "startSeconds": float(i)})
            last_boundary = i
        elif delta < -0.35:
            sections.append({"type": "breakdown", "startSeconds": float(i)})
            last_boundary = i
    return sections


def analyze(file_path: str) -> dict:
    loader = es.MonoLoader(filename=file_path)
    audio = loader()
    sample_rate = 44100  # MonoLoader default

    rhythm_extractor = es.RhythmExtractor2013(method="multifeature")
    bpm, beat_positions, _confidence, _estimates, _bpm_intervals = rhythm_extractor(audio)

    key, scale, _strength = es.KeyExtractor()(audio)
    camelot = to_camelot(key, scale)

    energy = energy_curve(audio, sample_rate)
    sections = find_sections(energy)

    first_downbeat = float(beat_positions[0]) if len(beat_positions) > 0 else 0.0

    duration_seconds = len(audio) / sample_rate
    beats_per_bar = 4
    seconds_per_beat = 60.0 / bpm if bpm > 0 else 0.5
    bar_seconds = seconds_per_beat * beats_per_bar

    # Cue-in: first downbeat after the intro (approximated as the first
    # beat position, since RhythmExtractor2013 already skips leading
    # silence). Cue-out: last downbeat 32 bars before the end, per §6.1.
    cue_in = first_downbeat
    cue_out = max(cue_in, duration_seconds - 32 * bar_seconds)

    meter = pyln.Meter(sample_rate)
    integrated_lufs = float(meter.integrated_loudness(audio.astype(np.float64)))

    return {
        "bpm": float(bpm),
        "beatPositionsSeconds": [float(b) for b in beat_positions],
        "firstDownbeatSeconds": first_downbeat,
        "key": key,
        "camelot": camelot,
        "energyCurve": energy,
        "sections": sections,
        "cueInSeconds": float(cue_in),
        "cueOutSeconds": float(cue_out),
        "integratedLufs": integrated_lufs,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--file", required=True, help="Path to the audio file to analyze")
    args = parser.parse_args()

    try:
        result = analyze(args.file)
    except Exception as exc:  # noqa: BLE001 - surface any failure to the caller as JSON-free stderr
        print(f"analysis failed for {args.file}: {exc}", file=sys.stderr)
        sys.exit(1)

    print(json.dumps(result))


if __name__ == "__main__":
    main()
