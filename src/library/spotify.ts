// Spotify Web API client — browse/search/import/taste-signal only, §2.2.
// Never touches playback audio (see spec §0.1: Widevine-encrypted PCM is
// never exposed to any process-level API, so there is nothing here to
// stream). OAuth PKCE so no client secret has to live in a desktop app.

const AUTH_BASE = "https://accounts.spotify.com";
const API_BASE = "https://api.spotify.com/v1";

// TODO: move to a settings screen / env config before shipping.
const CLIENT_ID = "";
const REDIRECT_URI = "http://127.0.0.1:5170/callback";
const SCOPES = ["playlist-read-private", "user-top-read", "user-read-recently-played"];

function base64UrlEncode(bytes: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function sha256(input: string): Promise<ArrayBuffer> {
  return crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
}

export interface PkcePair {
  verifier: string;
  challenge: string;
}

export async function generatePkce(): Promise<PkcePair> {
  const randomBytes = crypto.getRandomValues(new Uint8Array(64));
  const verifier = base64UrlEncode(randomBytes.buffer);
  const challenge = base64UrlEncode(await sha256(verifier));
  return { verifier, challenge };
}

export function buildAuthorizeUrl(challenge: string, state: string): string {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: "code",
    redirect_uri: REDIRECT_URI,
    code_challenge_method: "S256",
    code_challenge: challenge,
    scope: SCOPES.join(" "),
    state,
  });
  return `${AUTH_BASE}/authorize?${params.toString()}`;
}

export interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // epoch ms
}

// TODO(Phase 6): wire this to a loopback HTTP server (main process) that
// catches the redirect to REDIRECT_URI and hands the `code` back here — a
// desktop app can't receive a browser redirect directly. shell.openExternal
// opens the system browser for the /authorize step.
export async function exchangeCodeForToken(code: string, verifier: string): Promise<TokenResponse> {
  const res = await fetch(`${AUTH_BASE}/api/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      grant_type: "authorization_code",
      code,
      redirect_uri: REDIRECT_URI,
      code_verifier: verifier,
    }),
  });
  if (!res.ok) throw new Error(`token exchange failed: ${res.status}`);
  const json = await res.json();
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresAt: Date.now() + json.expires_in * 1000,
  };
}

export async function refreshToken(refreshToken: string): Promise<TokenResponse> {
  const res = await fetch(`${AUTH_BASE}/api/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });
  if (!res.ok) throw new Error(`token refresh failed: ${res.status}`);
  const json = await res.json();
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token ?? refreshToken,
    expiresAt: Date.now() + json.expires_in * 1000,
  };
}

async function apiGet<T>(path: string, accessToken: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Spotify API ${path} -> ${res.status}`);
  return res.json() as Promise<T>;
}

export interface SpotifyPlaylistSummary {
  id: string;
  name: string;
  trackCount: number;
}

export async function listMyPlaylists(accessToken: string): Promise<SpotifyPlaylistSummary[]> {
  const data = await apiGet<{ items: { id: string; name: string; tracks: { total: number } }[] }>(
    "/me/playlists?limit=50",
    accessToken,
  );
  return data.items.map((p) => ({ id: p.id, name: p.name, trackCount: p.tracks.total }));
}

export interface SpotifyPlaylistTrackRaw {
  spotifyTrackId: string;
  isrc: string | null;
  title: string;
  artist: string;
  durationSeconds: number;
}

export async function getPlaylistTracks(playlistId: string, accessToken: string): Promise<SpotifyPlaylistTrackRaw[]> {
  const tracks: SpotifyPlaylistTrackRaw[] = [];
  let url: string | null = `/playlists/${playlistId}/tracks?limit=100`;
  while (url) {
    const data: any = await apiGet(url, accessToken);
    for (const item of data.items) {
      const t = item.track;
      if (!t) continue;
      tracks.push({
        spotifyTrackId: t.id,
        isrc: t.external_ids?.isrc ?? null,
        title: t.name,
        artist: (t.artists ?? []).map((a: { name: string }) => a.name).join(", "),
        durationSeconds: t.duration_ms / 1000,
      });
    }
    url = data.next ? data.next.replace(API_BASE, "") : null;
  }
  return tracks;
}

export async function getTopTracks(accessToken: string): Promise<{ id: string; isrc: string | null }[]> {
  const data = await apiGet<{ items: { id: string; external_ids?: { isrc?: string } }[] }>(
    "/me/top/tracks?limit=50",
    accessToken,
  );
  return data.items.map((t) => ({ id: t.id, isrc: t.external_ids?.isrc ?? null }));
}
