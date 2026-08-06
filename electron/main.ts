import { app, BrowserWindow, ipcMain, dialog } from "electron";
import path from "node:path";
import { promises as fs } from "node:fs";
import { fileURLToPath } from "node:url";
import { getDb, upsertTrack, listTracks, findTrackByIsrc, type TrackRow } from "./db.js";
import { analyzeTrack } from "./analyzerBridge.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const isDev = !app.isPackaged;

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    backgroundColor: "#0a0a0c",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  if (isDev) {
    mainWindow.loadURL("http://localhost:5173");
    // Detached DevTools opens as a separate OS window that can steal focus
    // and end up on top of native dialogs (file picker, etc.), making them
    // look broken when they're actually just hidden behind it. Dock it
    // in-window instead — press F12 in the app if you need it.
  } else {
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// --- IPC surface -----------------------------------------------------------
// Renderer never touches the filesystem, SQLite, or the Python sidecar
// directly. Main process owns those and exposes a narrow, typed IPC surface
// via preload.ts. See src/library/db.ts and src/library/analyzerClient.ts
// for the renderer-side types these calls correspond to.

ipcMain.handle("library:selectMusicFolder", async () => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ["openDirectory"],
  });
  if (result.canceled) return null;
  return result.filePaths[0] ?? null;
});

// Single-file picker for the quick "Load track" button (Phase 1 loop, not
// full library import) — see index.html's #load-track-button.
ipcMain.handle("library:selectAudioFile", async () => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ["openFile"],
    filters: [{ name: "Audio", extensions: ["mp3", "wav", "flac", "aac", "m4a", "ogg"] }],
  });
  if (result.canceled) return null;
  return result.filePaths[0] ?? null;
});

const AUDIO_EXTENSIONS = new Set([".mp3", ".wav", ".flac", ".aac", ".m4a", ".ogg"]);
const MAX_SCAN_DEPTH = 4;

async function scanAudioFiles(dir: string, depth: number): Promise<string[]> {
  if (depth > MAX_SCAN_DEPTH) return [];
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }

  const results: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...(await scanAudioFiles(fullPath, depth + 1)));
    } else if (AUDIO_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      results.push(fullPath);
    }
  }
  return results;
}

// Recursive folder scan for the Library panel's "Import folder" flow — BPM
// detection itself happens client-side (src/library/bpmDetector.ts) since
// it just needs decoded audio, not a native dependency.
ipcMain.handle("library:listAudioFilesInFolder", async (_event, folderPath: string) => {
  return scanAudioFiles(folderPath, 0);
});

ipcMain.handle("library:readFileAsBuffer", async (_event, filePath: string) => {
  // TODO(Phase 1): validate filePath is inside the configured library root
  // before reading anything — this currently trusts the renderer's path.
  const buffer = await fs.readFile(filePath);
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
});

ipcMain.handle("sidecar:analyzeTrack", async (_event, filePath: string) => {
  return analyzeTrack(filePath);
});

ipcMain.handle("library:listTracks", async () => {
  return listTracks();
});

ipcMain.handle("library:upsertTrack", async (_event, track: Omit<TrackRow, "added_at">) => {
  upsertTrack(track);
});

ipcMain.handle("library:findTrackByIsrc", async (_event, isrc: string) => {
  return findTrackByIsrc(isrc) ?? null;
});

app.whenReady().then(() => {
  getDb(); // create/migrate on startup so first IPC call isn't the slow path
  createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
