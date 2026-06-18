// The shared audio output engine: one lazily-created AudioContext for all playback (metronome
// clicks, drone tone) and processing (audio-cell decode), a single resume/autoplay policy, and
// gain-ramped voice primitives. React-free — hooks layer on top.
//
// Out of scope by design: the Tuner keeps its own *input* context (mic capture, closed to free
// the mic), and abcjs owns its synth context. Only the output side is shared here.

type WebkitWindow = Window & { webkitAudioContext?: typeof AudioContext };

let ctx: AudioContext | null = null;

// The shared output context, created on first use (browsers start it suspended until a gesture).
export function output(): AudioContext {
  if (!ctx) {
    const Ctor = window.AudioContext || (window as WebkitWindow).webkitAudioContext!;
    ctx = new Ctor();
  }
  return ctx;
}

// Best-effort, idempotent resume — call on a user gesture to satisfy the autoplay policy.
export function resume(): void {
  const c = output();
  if (c.state === "suspended") void c.resume();
}

export interface ToneOptions {
  freq: number;
  when?: number; // schedule time on output().currentTime; default: now
  gain?: number; // peak gain (default 0.3)
  duration?: number; // total length in seconds (default 0.06)
  decay?: number; // exponential ramp-to-silence in seconds (default 0.05)
  type?: OscillatorType; // default "sine"
}

// One-shot percussive voice — the metronome click. Schedules an oscillator with a fast decay.
export function tone(opts: ToneOptions): void {
  const c = output();
  resume();
  const when = opts.when ?? c.currentTime;
  const peak = opts.gain ?? 0.3;
  const duration = opts.duration ?? 0.06;
  const decay = opts.decay ?? 0.05;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = opts.type ?? "sine";
  osc.frequency.value = opts.freq;
  gain.gain.setValueAtTime(peak, when);
  gain.gain.exponentialRampToValueAtTime(0.0001, when + decay);
  osc.connect(gain).connect(c.destination);
  osc.start(when);
  osc.stop(when + duration);
}

// A sounding sustained voice, with live control and a release on stop.
export interface Voice {
  setFrequency(freq: number): void;
  setGain(gain: number): void;
  stop(release?: number): void;
}

export interface StartToneOptions {
  freq: number;
  gain?: number; // target sustain gain (default 0.3)
  type?: OscillatorType; // default "triangle"
  attack?: number; // ramp-up in seconds (default 0.05)
}

// Sustained voice — the drone. Returns a handle for live freq/gain changes and a release stop.
export function startTone(opts: StartToneOptions): Voice {
  const c = output();
  resume();
  const target = opts.gain ?? 0.3;
  const attack = opts.attack ?? 0.05;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = opts.type ?? "triangle";
  osc.frequency.value = opts.freq;
  gain.gain.value = 0;
  osc.connect(gain).connect(c.destination);
  osc.start();
  gain.gain.linearRampToValueAtTime(target, c.currentTime + attack);

  let stopped = false;
  return {
    setFrequency(freq) {
      osc.frequency.setTargetAtTime(freq, c.currentTime, 0.02);
    },
    setGain(g) {
      gain.gain.setTargetAtTime(g, c.currentTime, 0.02);
    },
    stop(release = 0.08) {
      if (stopped) return;
      stopped = true;
      const now = c.currentTime;
      gain.gain.cancelScheduledValues(now);
      gain.gain.setValueAtTime(gain.gain.value, now);
      gain.gain.linearRampToValueAtTime(0, now + release);
      osc.stop(now + release + 0.02);
    },
  };
}
