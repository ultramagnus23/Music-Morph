// Renderer-side typed wrapper around the library IPC surface. Keeps
// better-sqlite3 (and Node) entirely out of the renderer — see electron/db.ts
// for the actual queries.

export interface Track {
  id: string;
  filePath: string;
  title: string | null;
  artist: string | null;
  durationSeconds: number | null;
  isrc: string | null;
  spotifyTrackId: string | null;
}

interface TrackRow {
  id: string;
  file_path: string;
  title: string | null;
  artist: string | null;
  duration_seconds: number | null;
  isrc: string | null;
  spotify_track_id: string | null;
}

function fromRow(row: TrackRow): Track {
  return {
    id: row.id,
    filePath: row.file_path,
    title: row.title,
    artist: row.artist,
    durationSeconds: row.duration_seconds,
    isrc: row.isrc,
    spotifyTrackId: row.spotify_track_id,
  };
}

function toRow(track: Track): TrackRow {
  return {
    id: track.id,
    file_path: track.filePath,
    title: track.title,
    artist: track.artist,
    duration_seconds: track.durationSeconds,
    isrc: track.isrc,
    spotify_track_id: track.spotifyTrackId,
  };
}

export async function listTracks(): Promise<Track[]> {
  const rows = (await window.handshake.library.listTracks()) as TrackRow[];
  return rows.map(fromRow);
}

export async function upsertTrack(track: Track): Promise<void> {
  await window.handshake.library.upsertTrack(toRow(track));
}

export async function findTrackByIsrc(isrc: string): Promise<Track | null> {
  const row = (await window.handshake.library.findTrackByIsrc(isrc)) as TrackRow | null;
  return row ? fromRow(row) : null;
}
