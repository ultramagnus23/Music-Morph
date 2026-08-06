// SQLite schema + queries, §2 "Library & brain". Lives in the main process
// (better-sqlite3 needs Node/native bindings the sandboxed renderer doesn't
// have) and is reached from src/library/dbClient.ts over IPC.

import Database from "better-sqlite3";
import path from "node:path";
import { app } from "electron";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS tracks (
  id TEXT PRIMARY KEY,
  file_path TEXT NOT NULL UNIQUE,
  title TEXT,
  artist TEXT,
  duration_seconds REAL,
  isrc TEXT,
  spotify_track_id TEXT,
  added_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tracks_isrc ON tracks(isrc);
CREATE INDEX IF NOT EXISTS idx_tracks_spotify_id ON tracks(spotify_track_id);

-- One row per track once the offline analyzer (sidecar/analyze.py) has run.
-- See §6.1 for field definitions.
CREATE TABLE IF NOT EXISTS analysis (
  track_id TEXT PRIMARY KEY REFERENCES tracks(id) ON DELETE CASCADE,
  bpm REAL,
  beat_positions_json TEXT, -- JSON number[] seconds
  first_downbeat_seconds REAL,
  key TEXT,
  camelot TEXT,
  energy_curve_json TEXT, -- JSON number[] 1s-window RMS, 0-1
  sections_json TEXT, -- JSON {type: string, startSeconds: number}[]
  cue_in_seconds REAL,
  cue_out_seconds REAL,
  integrated_lufs REAL,
  analyzed_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS play_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  track_id TEXT NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  played_at INTEGER NOT NULL,
  session_id TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_play_history_track ON play_history(track_id);

CREATE TABLE IF NOT EXISTS spotify_playlist_imports (
  spotify_playlist_id TEXT PRIMARY KEY,
  name TEXT,
  imported_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS spotify_playlist_tracks (
  spotify_playlist_id TEXT NOT NULL REFERENCES spotify_playlist_imports(spotify_playlist_id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  spotify_track_id TEXT NOT NULL,
  isrc TEXT,
  title TEXT,
  artist TEXT,
  duration_seconds REAL,
  matched_track_id TEXT REFERENCES tracks(id),
  PRIMARY KEY (spotify_playlist_id, position)
);
`;

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (db) return db;
  const dbPath = path.join(app.getPath("userData"), "handshake.sqlite3");
  db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.exec(SCHEMA);
  return db;
}

export interface TrackRow {
  id: string;
  file_path: string;
  title: string | null;
  artist: string | null;
  duration_seconds: number | null;
  isrc: string | null;
  spotify_track_id: string | null;
  added_at: number;
}

export function upsertTrack(track: Omit<TrackRow, "added_at">): void {
  getDb()
    .prepare(
      `INSERT INTO tracks (id, file_path, title, artist, duration_seconds, isrc, spotify_track_id, added_at)
       VALUES (@id, @file_path, @title, @artist, @duration_seconds, @isrc, @spotify_track_id, @added_at)
       ON CONFLICT(file_path) DO UPDATE SET
         title = excluded.title,
         artist = excluded.artist,
         duration_seconds = excluded.duration_seconds,
         isrc = excluded.isrc,
         spotify_track_id = excluded.spotify_track_id`,
    )
    .run({ ...track, added_at: Date.now() });
}

export function listTracks(): TrackRow[] {
  return getDb().prepare("SELECT * FROM tracks ORDER BY added_at DESC").all() as TrackRow[];
}

export function findTrackByIsrc(isrc: string): TrackRow | undefined {
  return getDb().prepare("SELECT * FROM tracks WHERE isrc = ?").get(isrc) as TrackRow | undefined;
}
