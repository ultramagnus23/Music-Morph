// Spawns the Python offline analyzer (sidecar/analyze.py) as a child
// process per track and speaks the line-delimited JSON protocol documented
// at the top of that file. Runs in the main process — the renderer never
// shells out directly.

import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export interface AnalysisResult {
  bpm: number;
  beatPositionsSeconds: number[];
  firstDownbeatSeconds: number;
  key: string;
  camelot: string;
  energyCurve: number[];
  sections: { type: string; startSeconds: number }[];
  cueInSeconds: number;
  cueOutSeconds: number;
  integratedLufs: number;
}

const SIDECAR_ENTRY = path.join(__dirname, "../sidecar/analyze.py");

export function analyzeTrack(filePath: string): Promise<AnalysisResult> {
  return new Promise((resolve, reject) => {
    const proc = spawn("python", [SIDECAR_ENTRY, "--file", filePath], {
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (chunk) => (stdout += chunk.toString()));
    proc.stderr.on("data", (chunk) => (stderr += chunk.toString()));

    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`analyze.py exited ${code}: ${stderr.trim()}`));
        return;
      }
      try {
        resolve(JSON.parse(stdout) as AnalysisResult);
      } catch (err) {
        reject(new Error(`analyze.py produced non-JSON output: ${stdout.slice(0, 500)}`));
      }
    });
  });
}
