// Matches Spotify playlist tracks to local library files, §2.2: "app
// matches each track to a local file by ISRC, then by fuzzy artist+title
// +duration; unmatched tracks are listed with a 'not in library' state."

import type { Track } from "./dbClient";

export interface SpotifyPlaylistTrack {
  spotifyTrackId: string;
  isrc: string | null;
  title: string;
  artist: string;
  durationSeconds: number;
}

export interface MatchResult {
  spotifyTrack: SpotifyPlaylistTrack;
  matchedTrack: Track | null;
  matchMethod: "isrc" | "fuzzy" | "unmatched";
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip accents
    .replace(/\(.*?\)|\[.*?\]/g, "") // strip "(feat. ...)", "[Remix]" etc.
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Levenshtein-based similarity, 0-1. Cheap and dependency-free; good enough
 * for "artist + title" strings which are short. */
function similarity(a: string, b: string): number {
  const na = normalize(a);
  const nb = normalize(b);
  if (na === nb) return 1;
  if (na.length === 0 || nb.length === 0) return 0;

  const rows = na.length + 1;
  const cols = nb.length + 1;
  const dist = Array.from({ length: rows }, (_, i) => {
    const row = new Array<number>(cols).fill(0);
    row[0] = i;
    return row;
  });
  for (let j = 0; j < cols; j++) dist[0][j] = j;

  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const cost = na[i - 1] === nb[j - 1] ? 0 : 1;
      dist[i][j] = Math.min(dist[i - 1][j] + 1, dist[i][j - 1] + 1, dist[i - 1][j - 1] + cost);
    }
  }

  const editDistance = dist[rows - 1][cols - 1];
  return 1 - editDistance / Math.max(na.length, nb.length);
}

const FUZZY_THRESHOLD = 0.85;
const DURATION_TOLERANCE_SECONDS = 3;

export function matchTrack(spotifyTrack: SpotifyPlaylistTrack, library: Track[]): MatchResult {
  if (spotifyTrack.isrc) {
    const isrcMatch = library.find((t) => t.isrc === spotifyTrack.isrc);
    if (isrcMatch) return { spotifyTrack, matchedTrack: isrcMatch, matchMethod: "isrc" };
  }

  let best: Track | null = null;
  let bestScore = 0;
  for (const track of library) {
    if (!track.title || !track.artist || track.durationSeconds === null) continue;
    if (Math.abs(track.durationSeconds - spotifyTrack.durationSeconds) > DURATION_TOLERANCE_SECONDS) continue;

    const titleSim = similarity(track.title, spotifyTrack.title);
    const artistSim = similarity(track.artist, spotifyTrack.artist);
    const score = titleSim * 0.6 + artistSim * 0.4;
    if (score > bestScore) {
      bestScore = score;
      best = track;
    }
  }

  if (best && bestScore >= FUZZY_THRESHOLD) {
    return { spotifyTrack, matchedTrack: best, matchMethod: "fuzzy" };
  }

  return { spotifyTrack, matchedTrack: null, matchMethod: "unmatched" };
}

export function matchPlaylist(spotifyTracks: SpotifyPlaylistTrack[], library: Track[]): MatchResult[] {
  return spotifyTracks.map((t) => matchTrack(t, library));
}
