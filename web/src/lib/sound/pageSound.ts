/**
 * PRD F-29 / DESIGN C-34 (10-19): the book's sounds, made with Web Audio — no audio files, nothing to license or load.
 * "open" = 펼침 A (a low thump of the cover and a short rustle), "flip" = 넘김 2 (paper sliding over, a soft swish).
 * Chosen by the user from docs/mockups/2026-10-19-page-sound.html. Played only from a tap (browsers allow sound then);
 * the AudioContext is made on the first sound. On by default, quiet; turning it off is remembered in this browser.
 */
export type PageSound = "open" | "flip";

/** "1" when the person turned the sound off (cleared when turned on again). */
export const SOUND_OFF_KEY = "galpi.sound.off";
/** Overall loudness — the mockup's default slider position. */
const VOLUME = 0.35;

let ctx: AudioContext | null = null;
let noiseBuffer: AudioBuffer | null = null;   // one half-second of white noise per context, reused by every rustle
let offThisLoad: boolean | null = null;   // the choice when storage is blocked: holds for this page load
const listeners = new Set<() => void>();

export function isSoundOn(): boolean {
  if (offThisLoad !== null) return !offThisLoad;
  try {
    return window.localStorage.getItem(SOUND_OFF_KEY) !== "1";
  } catch {
    return true;
  }
}

export function setSoundOn(on: boolean): void {
  offThisLoad = !on;
  try {
    if (on) window.localStorage.removeItem(SOUND_OFF_KEY);
    else window.localStorage.setItem(SOUND_OFF_KEY, "1");
    offThisLoad = null;   // stored: storage is the truth again
  } catch {
    // blocked storage: remembered for this page load only
  }
  for (const listener of listeners) listener();
}

/** For useSyncExternalStore: this tab or another changed the setting. */
export function subscribeSound(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

/** Test seam: module state survives between tests. */
export function forgetSoundForTests(): void {
  ctx = null;
  noiseBuffer = null;
  offThisLoad = null;
}

function audio(): AudioContext | null {
  if (ctx) return ctx;
  const Ctor = (window as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext
    ?? (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  ctx = new Ctor();
  return ctx;
}

function envelope(g: GainNode, t0: number, peak: number, attack: number, hold: number, release: number) {
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + attack);
  g.gain.setValueAtTime(peak, t0 + attack + hold);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + hold + release);
}

const NOISE_S = 0.5;   // longer than any rustle (0.34 s + 0.05 s tail)

function noise(c: AudioContext): AudioBuffer {
  if (noiseBuffer) return noiseBuffer;
  const buffer = c.createBuffer(1, Math.ceil(c.sampleRate * NOISE_S), c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  noiseBuffer = buffer;
  return buffer;
}

/** Filtered white noise whose band slides from `from` to `to` Hz — paper. */
function rustle(c: AudioContext, t0: number, o: { dur: number; from: number; to: number; q: number; peak: number; attack: number }) {
  const src = c.createBufferSource();
  src.buffer = noise(c);
  const filter = c.createBiquadFilter();
  filter.type = "bandpass";
  filter.Q.value = o.q;
  filter.frequency.setValueAtTime(o.from, t0);
  filter.frequency.exponentialRampToValueAtTime(o.to, t0 + o.dur);
  const gain = c.createGain();
  envelope(gain, t0, o.peak * VOLUME, o.attack, o.dur * 0.25, o.dur * 0.7);
  src.connect(filter).connect(gain).connect(c.destination);
  src.start(t0);
  src.stop(t0 + o.dur + 0.05);
}

/** A short falling sine — the cover meeting the table. */
function thump(c: AudioContext, t0: number, o: { freq: number; dur: number; peak: number }) {
  const osc = c.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(o.freq * 1.6, t0);
  osc.frequency.exponentialRampToValueAtTime(o.freq, t0 + o.dur);
  const gain = c.createGain();
  envelope(gain, t0, o.peak * VOLUME, 0.004, 0.01, o.dur);
  osc.connect(gain).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + o.dur + 0.05);
}

const SYNTH: Record<PageSound, (c: AudioContext, t: number) => void> = {
  open: (c, t) => {
    thump(c, t, { freq: 80, dur: 0.18, peak: 0.8 });
    rustle(c, t + 0.05, { dur: 0.2, from: 2200, to: 3800, q: 0.8, peak: 0.35, attack: 0.012 });
  },
  flip: (c, t) => {
    rustle(c, t, { dur: 0.34, from: 1400, to: 5200, q: 0.7, peak: 0.45, attack: 0.06 });
    rustle(c, t + 0.22, { dur: 0.09, from: 3000, to: 2200, q: 1.4, peak: 0.35, attack: 0.012 });
  },
};

/** Plays a book sound now — call it from the tap that turns the page. Never throws: no sound is better than a broken page. */
export function playPage(sound: PageSound): void {
  if (!isSoundOn()) return;
  try {
    const c = audio();
    if (!c) return;
    const playNow = () => SYNTH[sound](c, c.currentTime + 0.01);
    if (c.state === "running") {
      playNow();
      return;
    }
    // "suspended" (no tap yet) or iOS "interrupted" (after a call or the app in the background): wake it first. Scheduling on
    // a stopped clock would pile the sounds up and play them all at once later — so sound only once it runs, or not at all.
    c.resume().then(() => { if (c.state === "running") playNow(); }).catch(() => { /* stays silent */ });
  } catch {
    // no audio on this device
  }
}
