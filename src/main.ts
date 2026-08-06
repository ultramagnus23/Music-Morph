// Renderer entry point. Wires camera -> HandTracker -> ControlBus ->
// AudioEngine, and drives the HUD/skeleton/confidence-meter/deck/library UI
// from the same tracker frames. This is deliberately the "everything talks
// through events, nothing reaches into anything else's internals" seam
// described in the architecture diagram, §2.
//
// Two decks are wired (not just Deck A) so gestures + a crossfader can
// actually perform a track-to-track transition — a single-deck UI can't
// express the product's core "two decks" premise (§2.1). BPM is detected
// client-side (src/library/bpmDetector.ts) rather than via the Python
// sidecar — Essentia has no Windows wheel, so the sidecar path isn't
// realistic to depend on for "load a track and get a BPM" working today.

import { HandTracker } from "./vision/handTracker";
import { SkeletonOverlay } from "./ui/skeletonOverlay";
import { HudPanel } from "./ui/hud";
import { WaveformStrip } from "./ui/waveform";
import { ConfidenceMeter } from "./ui/confidenceMeter";
import { renderGestureLegend } from "./ui/gestureLegend";
import { DebugReadout } from "./ui/debugReadout";
import { AudioEngine } from "./audio/audioEngine";
import { describeError } from "./util/describeError";
import { detectBeatgrid } from "./library/bpmDetector";
import { bpmCompatibility } from "./library/selector";
import type { Deck } from "./audio/deck";

const video = document.getElementById("camera-feed") as HTMLVideoElement;
const canvas = document.getElementById("skeleton-overlay") as HTMLCanvasElement;
const confidenceMeterEl = document.getElementById("confidence-meter") as HTMLDivElement;
const hudLeftEl = document.getElementById("hud-left") as HTMLDivElement;
const hudRightEl = document.getElementById("hud-right") as HTMLDivElement;
const startScreen = document.getElementById("start-screen") as HTMLDivElement;
const startButton = document.getElementById("start-button") as HTMLButtonElement;
const startStatus = document.getElementById("start-status") as HTMLDivElement;
const consoleEl = document.getElementById("console") as HTMLDivElement;
const topLeftToggles = document.getElementById("top-left-toggles") as HTMLDivElement;
const legendToggle = document.getElementById("legend-toggle") as HTMLButtonElement;
const gestureLegendEl = document.getElementById("gesture-legend") as HTMLDivElement;
const libraryToggle = document.getElementById("library-toggle") as HTMLButtonElement;
const libraryPanelEl = document.getElementById("library-panel") as HTMLDivElement;
const libraryStatusEl = document.getElementById("library-status") as HTMLDivElement;
const libraryListEl = document.getElementById("library-list") as HTMLDivElement;
const importFolderButton = document.getElementById("import-folder-button") as HTMLButtonElement;
const debugReadoutEl = document.getElementById("debug-readout") as HTMLDivElement;
const crossfaderInput = document.getElementById("crossfader") as HTMLInputElement;
const transitionToBButton = document.getElementById("transition-to-b") as HTMLButtonElement;
const transitionToAButton = document.getElementById("transition-to-a") as HTMLButtonElement;

const hudLeft = new HudPanel(hudLeftEl);
const hudRight = new HudPanel(hudRightEl);
const skeleton = new SkeletonOverlay(canvas);
const confidenceMeter = new ConfidenceMeter(confidenceMeterEl);
const debugReadout = new DebugReadout(debugReadoutEl);

interface DeckUi {
  key: "A" | "B";
  waveform: WaveformStrip;
  waveformCanvas: HTMLCanvasElement;
  filenameEl: HTMLElement;
  bpmEl: HTMLElement;
  loadButton: HTMLButtonElement;
  playButton: HTMLButtonElement;
  gestureToggle: HTMLButtonElement;
  isPlaying: boolean;
  bpm: number | null;
}

function makeDeckUi(key: "A" | "B"): DeckUi {
  const suffix = key.toLowerCase();
  const waveformCanvas = document.getElementById(`waveform-${suffix}`) as HTMLCanvasElement;
  return {
    key,
    waveform: new WaveformStrip(waveformCanvas),
    waveformCanvas,
    filenameEl: document.getElementById(`filename-${suffix}`) as HTMLElement,
    bpmEl: document.getElementById(`bpm-${suffix}`) as HTMLElement,
    loadButton: document.getElementById(`load-${suffix}`) as HTMLButtonElement,
    playButton: document.getElementById(`play-${suffix}`) as HTMLButtonElement,
    gestureToggle: document.querySelector(`.deck__gesture-toggle[data-deck-target="${key}"]`) as HTMLButtonElement,
    isPlaying: false,
    bpm: null,
  };
}

const decks: Record<"A" | "B", DeckUi> = { A: makeDeckUi("A"), B: makeDeckUi("B") };

interface LibraryTrack {
  filePath: string;
  name: string;
  bpm: number | null;
}

let audioEngine: AudioEngine | null = null;
let debugVisible = false;
let libraryTracks: LibraryTrack[] = [];

function resizeCanvases(): void {
  skeleton.resize(window.innerWidth, window.innerHeight);
  for (const deck of Object.values(decks)) {
    deck.waveformCanvas.width = deck.waveformCanvas.clientWidth;
    deck.waveformCanvas.height = deck.waveformCanvas.clientHeight;
  }
}
window.addEventListener("resize", resizeCanvases);
resizeCanvases();

function setStatus(text: string, isError = false): void {
  startStatus.textContent = text;
  startStatus.classList.toggle("is-error", isError);
}

async function startCamera(): Promise<void> {
  setStatus("Requesting camera…");
  let stream: MediaStream;
  try {
    // Camera data never leaves the machine (§11) — this feeds MediaPipe
    // locally and is never sent anywhere over the network.
    stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 640, height: 480, frameRate: 60 },
      audio: false,
    });
  } catch (err) {
    throw new Error(`Camera access failed: ${describeError(err)}`);
  }
  video.srcObject = stream;
  try {
    await video.play();
  } catch (err) {
    throw new Error(`Camera stream wouldn't start playing: ${describeError(err)}`);
  }
}

async function startHandTracking(): Promise<HandTracker> {
  setStatus("Loading hand tracking model…");
  const tracker = new HandTracker();
  try {
    await tracker.init();
  } catch (err) {
    throw new Error(`Hand tracking failed to load: ${describeError(err)}`);
  }
  return tracker;
}

async function startAudio(): Promise<AudioEngine> {
  setStatus("Starting audio engine…");
  try {
    return await AudioEngine.create();
  } catch (err) {
    throw new Error(`Audio engine failed to start: ${describeError(err)}`);
  }
}

function setActiveGestureDeck(key: "A" | "B"): void {
  audioEngine?.setActiveDeck(key);
  for (const deck of Object.values(decks)) {
    deck.gestureToggle.classList.toggle("is-active", deck.key === key);
  }
}

function deckByEngine(key: "A" | "B"): Deck {
  return key === "A" ? audioEngine!.deckA : audioEngine!.deckB;
}

// ---------- Loading a track into a deck (shared by the deck's own Load
// button and by the library panel's per-row "load into A/B" buttons) ----------

async function loadFileIntoDeck(deck: DeckUi, filePath: string): Promise<void> {
  if (!audioEngine) return;
  deck.loadButton.disabled = true;
  try {
    deck.filenameEl.textContent = "Decoding…";
    const arrayBuffer = await window.handshake.library.readFileAsBuffer(filePath);
    const audioBuffer = await audioEngine.decodeFile(arrayBuffer);

    deck.filenameEl.textContent = "Detecting tempo…";
    const beatgrid = detectBeatgrid(audioBuffer);
    deck.bpm = beatgrid.bpm;

    deckByEngine(deck.key).loadBuffer(audioBuffer, beatgrid);
    deck.waveform.loadBuffer(audioBuffer);

    const name = filePath.split(/[\\/]/).pop() ?? filePath;
    deck.filenameEl.textContent = name;
    deck.bpmEl.textContent = `${beatgrid.bpm.toFixed(1)} BPM`;
    deck.playButton.disabled = false;
    renderLibraryList(); // reference BPM for compatibility highlighting may have changed
  } catch (err) {
    deck.filenameEl.textContent = `Failed to load: ${describeError(err)}`;
    console.error(`Load track (deck ${deck.key}) failed:`, err);
  } finally {
    deck.loadButton.disabled = false;
  }
}

function wireDeckControls(deck: DeckUi): void {
  deck.gestureToggle.addEventListener("click", () => setActiveGestureDeck(deck.key));

  deck.loadButton.addEventListener("click", async () => {
    const filePath = await window.handshake.library.selectAudioFile();
    if (!filePath) return; // user cancelled the picker
    await loadFileIntoDeck(deck, filePath);
  });

  deck.playButton.addEventListener("click", () => {
    if (!audioEngine) return;
    const engineDeck = deckByEngine(deck.key);
    if (deck.isPlaying) {
      engineDeck.stop();
      deck.isPlaying = false;
      deck.playButton.textContent = "Play";
    } else {
      engineDeck.play(0);
      engineDeck.setGain(1);
      deck.isPlaying = true;
      deck.playButton.textContent = "Stop";
    }
    renderLibraryList();
  });
}

wireDeckControls(decks.A);
wireDeckControls(decks.B);

crossfaderInput.addEventListener("input", () => {
  audioEngine?.crossfader.setPosition(Number(crossfaderInput.value) / 100);
});

// ---------- Auto-transition: bass-swap crossfade over 8s, §6.3 step 4 ----------
// Two kick drums playing full-volume at once is the classic amateur
// mistake; this ramps the outgoing deck's low band down and the incoming
// deck's low band up across the transition instead of just crossfading
// everything at once.

function runTransition(fromKey: "A" | "B", toKey: "A" | "B"): void {
  if (!audioEngine) return;
  const fromDeck = deckByEngine(fromKey);
  const toDeck = deckByEngine(toKey);
  const toUi = decks[toKey];

  if (!toUi.isPlaying) {
    toDeck.play(0);
    toDeck.setGain(1);
    toUi.isPlaying = true;
    toUi.playButton.textContent = "Stop";
  }

  const durationMs = 8000;
  const startVal = fromKey === "A" ? 0 : 1;
  const endVal = fromKey === "A" ? 1 : 0;
  const startTime = performance.now();

  function tick(now: number): void {
    const t = Math.min(1, (now - startTime) / durationMs);
    const pos = startVal + (endVal - startVal) * t;
    audioEngine!.crossfader.setPosition(pos);
    crossfaderInput.value = String(Math.round(pos * 100));

    fromDeck.isolator.setBandGain("low", -24 * t, audioEngine!.ctx);
    toDeck.isolator.setBandGain("low", -24 * (1 - t), audioEngine!.ctx);

    if (t < 1) {
      requestAnimationFrame(tick);
    } else {
      fromDeck.isolator.setBandGain("low", 0, audioEngine!.ctx);
      toDeck.isolator.setBandGain("low", 0, audioEngine!.ctx);
      renderLibraryList();
    }
  }
  requestAnimationFrame(tick);
}

transitionToBButton.addEventListener("click", () => runTransition("A", "B"));
transitionToAButton.addEventListener("click", () => runTransition("B", "A"));

// ---------- Panels: gesture legend / library (mutually exclusive, share
// the same top-left slot) ----------

function showPanel(which: "legend" | "library" | "none"): void {
  gestureLegendEl.classList.toggle("hidden", which !== "legend");
  libraryPanelEl.classList.toggle("hidden", which !== "library");
  debugVisible = which === "legend";
  debugReadoutEl.classList.toggle("hidden", !debugVisible);
}

legendToggle.addEventListener("click", () => {
  showPanel(gestureLegendEl.classList.contains("hidden") ? "legend" : "none");
});

libraryToggle.addEventListener("click", () => {
  showPanel(libraryPanelEl.classList.contains("hidden") ? "library" : "none");
});

// ---------- Library: import a folder, analyze every track's BPM
// client-side, list sorted/highlighted by tempo compatibility with
// whichever deck is currently the mixing reference ----------

function currentReferenceBpm(): number | null {
  if (decks.A.isPlaying && decks.A.bpm !== null) return decks.A.bpm;
  if (decks.B.isPlaying && decks.B.bpm !== null) return decks.B.bpm;
  return decks.A.bpm ?? decks.B.bpm ?? null;
}

const COMPATIBLE_THRESHOLD = 0.7;

function renderLibraryList(): void {
  const reference = currentReferenceBpm();
  const sorted = [...libraryTracks].sort((a, b) => {
    if (reference === null || a.bpm === null || b.bpm === null) return (a.bpm ?? 0) - (b.bpm ?? 0);
    return bpmCompatibility(reference, b.bpm) - bpmCompatibility(reference, a.bpm);
  });

  libraryListEl.replaceChildren(
    ...sorted.map((track) => {
      const compatible =
        reference !== null && track.bpm !== null && bpmCompatibility(reference, track.bpm) >= COMPATIBLE_THRESHOLD;

      const row = document.createElement("div");
      row.className = "library-row";

      const bpmEl = document.createElement("span");
      bpmEl.className = `library-row__bpm${compatible ? " is-compatible" : ""}`;
      bpmEl.textContent = track.bpm !== null ? track.bpm.toFixed(1) : "—";

      const nameEl = document.createElement("span");
      nameEl.className = "library-row__name";
      nameEl.title = track.name;
      nameEl.textContent = track.name;

      const actionsEl = document.createElement("span");
      actionsEl.className = "library-row__actions";
      for (const key of ["A", "B"] as const) {
        const btn = document.createElement("button");
        btn.className = "btn btn--tiny";
        btn.textContent = key;
        btn.addEventListener("click", () => loadFileIntoDeck(decks[key], track.filePath));
        actionsEl.appendChild(btn);
      }

      row.append(bpmEl, nameEl, actionsEl);
      return row;
    }),
  );
}

importFolderButton.addEventListener("click", async () => {
  if (!audioEngine) return;
  const folder = await window.handshake.library.selectMusicFolder();
  if (!folder) return;

  importFolderButton.disabled = true;
  try {
    libraryStatusEl.textContent = "Scanning folder…";
    const filePaths = await window.handshake.library.listAudioFilesInFolder(folder);
    if (filePaths.length === 0) {
      libraryStatusEl.textContent = "No audio files found in that folder.";
      return;
    }

    libraryTracks = [];
    renderLibraryList();

    for (let i = 0; i < filePaths.length; i++) {
      libraryStatusEl.textContent = `Analyzing ${i + 1} of ${filePaths.length}…`;
      const filePath = filePaths[i];
      try {
        const arrayBuffer = await window.handshake.library.readFileAsBuffer(filePath);
        const audioBuffer = await audioEngine.decodeFile(arrayBuffer);
        const { bpm } = detectBeatgrid(audioBuffer);
        libraryTracks.push({ filePath, name: filePath.split(/[\\/]/).pop() ?? filePath, bpm });
      } catch (err) {
        console.warn(`Could not analyze ${filePath}:`, describeError(err));
      }
      renderLibraryList();
    }

    libraryStatusEl.textContent = `${libraryTracks.length} track(s) analyzed.`;
  } catch (err) {
    libraryStatusEl.textContent = `Import failed: ${describeError(err)}`;
  } finally {
    importFolderButton.disabled = false;
  }
});

startButton.addEventListener("click", async () => {
  startButton.disabled = true;
  setStatus("Requesting camera…");
  try {
    await startCamera();
    const tracker = await startHandTracking();
    audioEngine = await startAudio();
    setActiveGestureDeck("A");

    renderGestureLegend(gestureLegendEl);

    tracker.onFrame((frame) => {
      skeleton.draw(frame);
      audioEngine!.controlBus.publishTrackerFrame(frame);

      hudLeft.update(frame.hands.find((h) => h.id === "left"), canvas.width, canvas.height);
      hudRight.update(frame.hands.find((h) => h.id === "right"), canvas.width, canvas.height);
      confidenceMeter.update(frame.confidence);
      if (debugVisible) debugReadout.update(frame);

      for (const deck of Object.values(decks)) {
        if (deck.isPlaying) {
          const engineDeck = deckByEngine(deck.key);
          deck.waveform.draw(engineDeck.beatClock, engineDeck.playheadSeconds, null);
        }
      }
    });

    tracker.start(video);

    startScreen.classList.add("hidden");
    consoleEl.classList.remove("hidden");
    topLeftToggles.classList.remove("hidden");
    // Legend starts open — "I can't remember what each shape does" is the
    // default state for a first-time (or fiftieth-time) performer.
    showPanel("legend");
  } catch (err) {
    setStatus(describeError(err), true);
    startButton.disabled = false;
    console.error("HANDSHAKE failed to start:", err);
  }
});
