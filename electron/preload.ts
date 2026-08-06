import { contextBridge, ipcRenderer } from "electron";

// Everything the renderer is allowed to ask the main process for.
// Camera access and Web Audio stay entirely in the renderer (they don't
// need Node/OS privileges); only filesystem, SQLite, and the Python
// sidecar cross the IPC boundary, per §7.5's "camera data never leaves
// the machine" requirement and general least-privilege practice.
const api = {
  library: {
    selectMusicFolder: (): Promise<string | null> =>
      ipcRenderer.invoke("library:selectMusicFolder"),
    selectAudioFile: (): Promise<string | null> =>
      ipcRenderer.invoke("library:selectAudioFile"),
    listAudioFilesInFolder: (folderPath: string): Promise<string[]> =>
      ipcRenderer.invoke("library:listAudioFilesInFolder", folderPath),
    readFileAsBuffer: (filePath: string): Promise<ArrayBuffer> =>
      ipcRenderer.invoke("library:readFileAsBuffer", filePath),
    listTracks: (): Promise<unknown[]> => ipcRenderer.invoke("library:listTracks"),
    upsertTrack: (track: unknown): Promise<void> => ipcRenderer.invoke("library:upsertTrack", track),
    findTrackByIsrc: (isrc: string): Promise<unknown | null> =>
      ipcRenderer.invoke("library:findTrackByIsrc", isrc),
  },
  sidecar: {
    analyzeTrack: (filePath: string): Promise<unknown> =>
      ipcRenderer.invoke("sidecar:analyzeTrack", filePath),
  },
};

contextBridge.exposeInMainWorld("handshake", api);

export type HandshakeApi = typeof api;
