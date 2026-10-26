// Web Audio for iOS 12 Safari: only `webkitAudioContext` exists, node constructors
// (`new OscillatorNode()`) don't, and audio stays silent until a touch handler plays a sound.
// Note: the iPad's side switch, when set to Mute, silences Web Audio entirely.

let ctx: AudioContext | null = null;
let master: GainNode | null = null;

function getConstructor(): typeof AudioContext | undefined {
  // Unprefixed first for newer browsers (parent phones); the iPad only has the webkit one.
  // eslint-disable-next-line compat/compat
  return window.AudioContext || window.webkitAudioContext;
}

function playSilentBuffer(c: AudioContext, sampleRate: number) {
  const source = c.createBufferSource();
  source.buffer = c.createBuffer(1, 1, sampleRate);
  source.connect(c.destination);
  source.start(0);
}

// iOS sometimes creates a context whose sample rate doesn't match the hardware, which makes
// every sound come out distorted. Playing a buffer at the right rate and recreating fixes it.
function createContext(): AudioContext | null {
  const Ctor = getConstructor();
  if (!Ctor) return null;
  const desired = 44100;
  let c = new Ctor();
  if (c.sampleRate !== desired) {
    playSilentBuffer(c, desired);
    if (typeof c.close === 'function') void c.close();
    c = new Ctor();
  }
  return c;
}

/** Call from inside a touchend/click handler. Safe to call on every tap. */
export function unlockAudio(): void {
  if (!ctx) {
    ctx = createContext();
    if (!ctx) return;
    master = ctx.createGain();
    master.gain.value = 0.6;
    master.connect(ctx.destination);
  }
  playSilentBuffer(ctx, ctx.sampleRate);
  // iOS suspends the context after interruptions or long idle; resuming must happen in a gesture.
  if (ctx.state !== 'running' && typeof ctx.resume === 'function') void ctx.resume();
}

export function audioStatus(): { supported: boolean; state: string; sampleRate: number } {
  return {
    supported: !!getConstructor(),
    state: ctx ? ctx.state : 'not created',
    sampleRate: ctx ? ctx.sampleRate : 0,
  };
}

interface Note {
  freq: number;
  at: number;
  dur: number;
}

let enabled = true;
let volume = 0.7;

export function configureSound(on: boolean, vol: number): void {
  enabled = on;
  volume = vol;
  if (master) master.gain.value = vol;
}

function playNotes(notes: Note[], wave: OscillatorType, peak: number) {
  if (!enabled || !ctx || !master) return;
  master.gain.value = volume;
  const start = ctx.currentTime + 0.02;
  for (const n of notes) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = wave;
    osc.frequency.setValueAtTime(n.freq, start + n.at);
    // Exponential ramps can't start or end at 0.
    gain.gain.setValueAtTime(0.0001, start + n.at);
    gain.gain.exponentialRampToValueAtTime(peak, start + n.at + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + n.at + n.dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(start + n.at);
    osc.stop(start + n.at + n.dur + 0.05);
  }
}

const midi = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
const seq = (notes: number[], step: number, dur: number, lastDur = dur): Note[] =>
  notes.map((m, i) => ({ freq: midi(m), at: i * step, dur: i === notes.length - 1 ? lastDur : dur }));

// All sounds are original, synthesized tones. Each theme has a set; unknown themes use quest's.

interface SoundSet {
  step(): void;
  complete(): void;
  badge(): void;
}

const SOUND_SETS: Record<string, SoundSet> = {
  /** Rising adventure arpeggio. */
  quest: {
    step: () => playNotes(seq([72, 79], 0.06, 0.12), 'square', 0.08),
    complete: () => playNotes(seq([60, 64, 67, 72, 76, 79, 84], 0.075, 0.18, 0.6), 'square', 0.12),
    badge: () => {
      playNotes(seq([67, 67, 67, 72], 0.14, 0.12, 0.9), 'square', 0.1);
      playNotes(seq([55, 60, 64], 0.14, 0.4, 0.9), 'triangle', 0.15);
    },
  },
  /** Soft chimes and twinkles. */
  sparkle: {
    step: () => playNotes(seq([91, 96], 0.05, 0.25), 'sine', 0.2),
    complete: () => playNotes(seq([84, 88, 91, 96, 91, 96, 100], 0.06, 0.5), 'sine', 0.25),
    badge: () => {
      playNotes(seq([96, 100, 103, 108, 103, 108, 112, 108], 0.09, 0.6, 1.2), 'sine', 0.22);
      playNotes(seq([72, 76, 79], 0.3, 1.0), 'triangle', 0.12);
    },
  },
  /** Bleepy computer blips and a launch sweep. */
  space: {
    step: () => playNotes(seq([84, 91], 0.04, 0.08), 'square', 0.07),
    complete: () => playNotes(seq([60, 67, 72, 79, 84, 91, 96, 103], 0.045, 0.1, 0.45), 'sawtooth', 0.06),
    badge: () => {
      playNotes(seq([72, 79, 84, 91, 96, 103, 108], 0.07, 0.12, 0.8), 'square', 0.07);
      playNotes(seq([48, 55, 60], 0.2, 0.6, 1.0), 'triangle', 0.15);
    },
  },
  /** Bubbly pops. */
  ocean: {
    step: () => playNotes(seq([79, 86], 0.05, 0.1), 'sine', 0.2),
    complete: () => playNotes(seq([74, 81, 78, 86, 83, 90, 93], 0.07, 0.14, 0.5), 'sine', 0.22),
    badge: () => {
      playNotes(seq([74, 78, 81, 86, 90, 93, 98], 0.08, 0.2, 1.0), 'sine', 0.2);
      playNotes(seq([62, 66, 69], 0.25, 0.8), 'triangle', 0.12);
    },
  },
  /** Low stomps and a jungle drum flourish. */
  dino: {
    step: () => playNotes(seq([43, 50], 0.08, 0.15), 'triangle', 0.25),
    complete: () => playNotes(seq([43, 43, 50, 55, 62, 67], 0.11, 0.15, 0.5), 'triangle', 0.25),
    badge: () => {
      playNotes(seq([43, 43, 43, 55, 62, 67, 74], 0.13, 0.16, 0.9), 'triangle', 0.25);
      playNotes(seq([67, 71, 74], 0.39, 0.6), 'square', 0.06);
    },
  },
};

const setFor = (theme: string) => SOUND_SETS[theme] || SOUND_SETS.quest;

export const sounds = {
  tap(): void {
    playNotes([{ freq: midi(88), at: 0, dur: 0.06 }], 'sine', 0.12);
  },
  step(theme: string): void {
    setFor(theme).step();
  },
  complete(theme: string): void {
    setFor(theme).complete();
  },
  badge(theme: string): void {
    setFor(theme).badge();
  },
  /** Super Bonus arrives: a "ta-da" call over a bass, then a sparkle run. */
  superBonus(): void {
    const call = [67, 67, 72, 76, 79];
    const at = [0, 0.14, 0.28, 0.62, 0.76];
    const dur = [0.12, 0.12, 0.45, 0.12, 0.9];
    playNotes(call.map((m, i) => ({ freq: midi(m), at: at[i], dur: dur[i] })), 'square', 0.1);
    playNotes([{ freq: midi(48), at: 0.28, dur: 0.45 }, { freq: midi(55), at: 0.76, dur: 0.9 }], 'triangle', 0.2);
    playNotes(seq([91, 95, 98, 103, 107], 0.06, 0.25, 0.6).map((n) => ({ freq: n.freq, at: n.at + 0.95, dur: n.dur })), 'sine', 0.12);
  },
  /** Team finished a Super Bonus: a quick run up and three big chords. */
  superWin(): void {
    const chord = (at: number, notes: number[], dur: number): Note[] => notes.map((m) => ({ freq: midi(m), at, dur }));
    playNotes(seq([60, 64, 67, 72, 76, 79, 84], 0.06, 0.14), 'square', 0.09);
    playNotes(chord(0.5, [72, 76, 79], 0.2).concat(chord(0.75, [74, 77, 81], 0.2), chord(1.0, [76, 79, 84], 1.2)), 'square', 0.06);
    playNotes(chord(0.5, [48], 0.2).concat(chord(0.75, [50], 0.2), chord(1.0, [52, 60], 1.2)), 'triangle', 0.2);
    playNotes(seq([96, 100, 103, 108, 103, 108, 112], 0.07, 0.3, 0.8).map((n) => ({ freq: n.freq, at: n.at + 1.1, dur: n.dur })), 'sine', 0.1);
  },
  undo(): void {
    playNotes(seq([76, 72], 0.08, 0.15), 'sine', 0.15);
  },
  oops(): void {
    playNotes(seq([64, 62], 0.1, 0.15), 'triangle', 0.15);
  },
};
