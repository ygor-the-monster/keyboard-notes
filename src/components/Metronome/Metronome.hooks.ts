import { useEffect, useRef, useState } from "react";
import { output, resume, tone } from "../../utils/audioEngine/audioEngine.ts";

// Sample-accurate metronome using a Web Audio lookahead scheduler (the "Tale of Two Clocks"
// pattern): a coarse setInterval wakes up often and schedules click voices at exact context
// sample times, so timing never drifts the way a bare setInterval(60000/bpm) does. Two voices run
// off independent time accumulators that realign every bar: the main layer (beats × subdivisions,
// with the accent pattern) and an optional polyrhythm layer (N even pulses across the same bar). A
// requestAnimationFrame loop reads the same context clock to surface the *currently sounding* beat
// and poly step, so the visual indicators stay in sync with what you hear.
const LOOKAHEAD_S = 0.1; // schedule clicks up to 100ms ahead
const TICK_MS = 25; // how often the scheduler wakes up

// Per-beat accent level. 0 = muted, 1 = weak (normal click), 2 = strong (accent).
export type AccentLevel = 0 | 1 | 2;

// A sound preset: the oscillator voice for weak vs strong beats.
export interface ToneSpec {
  accent: { freq: number; type: OscillatorType };
  beat: { freq: number; type: OscillatorType };
}

// Polyrhythm layer voice — a different timbre/pitch from the main click so the two pulses are
// distinguishable by ear (the visual layer stays in the magenta family, just paler).
const POLY_VOICE = { type: "triangle" as OscillatorType, accentFreq: 1500, beatFreq: 1180 };

export function useMetronome({
  bpm,
  beats,
  pattern,
  sound,
  subdiv,
  poly,
}: {
  bpm: number;
  beats: number;
  pattern: AccentLevel[];
  sound: ToneSpec;
  subdiv: number; // subdivisions per beat (1 = none)
  poly: number; // polyrhythm pulses per bar (0/1 = off)
}) {
  const [running, setRunning] = useState(false);
  const [currentBeat, setCurrentBeat] = useState(-1);
  const [currentPoly, setCurrentPoly] = useState(-1);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const rafRef = useRef(0);
  const runningRef = useRef(false);

  // Independent layer clocks (absolute context times) + their step counters.
  const mainTime = useRef(0);
  const mainStep = useRef(0); // counts subdivisions: beat = floor(step / subdiv)
  const polyTime = useRef(0);
  const polyStep = useRef(0);
  // Beats scheduled but not yet sounded — drained by the rAF loop to drive the indicators.
  const queueRef = useRef<{ time: number; beat?: number; poly?: number }[]>([]);

  // Keep latest params readable inside the scheduler without restarting it.
  const bpmRef = useRef(bpm);
  bpmRef.current = bpm || 90;
  const beatsRef = useRef(beats);
  beatsRef.current = beats || 4;
  const patternRef = useRef(pattern);
  patternRef.current = pattern;
  const soundRef = useRef(sound);
  soundRef.current = sound;
  const subdivRef = useRef(subdiv);
  subdivRef.current = Math.max(1, subdiv || 1);
  const polyRef = useRef(poly);
  polyRef.current = poly || 0;

  function scheduler() {
    const now = output().currentTime;
    // Drop events that already passed unseen (e.g. while backgrounded) so the queue stays bounded
    // and the indicators catch up to the present on return.
    const q = queueRef.current;
    while (q.length && q[0].time < now - 0.2) q.shift();

    const sub = subdivRef.current;
    const beatsN = beatsRef.current;
    const beatDur = 60 / bpmRef.current;
    const barDur = beatsN * beatDur;
    const mainInterval = beatDur / sub;
    const polyN = polyRef.current;
    const horizon = now + LOOKAHEAD_S;

    // Interleave the two layers by time until both reach the lookahead horizon.
    while (true) {
      const nextMain = mainTime.current;
      const nextPoly = polyN > 1 ? polyTime.current : Infinity;
      const next = Math.min(nextMain, nextPoly);
      if (next >= horizon) break;

      if (nextMain <= nextPoly) {
        const step = mainStep.current;
        const subIndex = step % sub;
        const beat = Math.floor(step / sub) % beatsN;
        const level = patternRef.current[beat] ?? 1;
        if (level > 0) {
          if (subIndex === 0) {
            const v = level === 2 ? soundRef.current.accent : soundRef.current.beat;
            tone({ when: nextMain, freq: v.freq, type: v.type, gain: level === 2 ? 0.5 : 0.32 });
            queueRef.current.push({ time: nextMain, beat });
          } else {
            // In-between subdivision — softer, shorter tick of the same voice.
            const v = soundRef.current.beat;
            tone({ when: nextMain, freq: v.freq, type: v.type, gain: 0.14, duration: 0.04, decay: 0.03 });
          }
        } else if (subIndex === 0) {
          // Muted beat: no sound, but the indicator still advances.
          queueRef.current.push({ time: nextMain, beat });
        }
        mainTime.current += mainInterval;
        mainStep.current = (mainStep.current + 1) % (beatsN * sub);
      } else {
        const pstep = polyStep.current;
        const accent = pstep === 0;
        tone({
          when: nextPoly,
          freq: accent ? POLY_VOICE.accentFreq : POLY_VOICE.beatFreq,
          type: POLY_VOICE.type,
          gain: accent ? 0.34 : 0.28,
          duration: 0.05,
          decay: 0.04,
        });
        queueRef.current.push({ time: nextPoly, poly: pstep });
        polyTime.current += barDur / polyN;
        polyStep.current = (polyStep.current + 1) % polyN;
      }
    }
  }

  // Advance the displayed beat/poly step the instant its scheduled context time arrives.
  function draw() {
    const now = output().currentTime;
    const q = queueRef.current;
    let b = -2; // sentinels: nothing new this frame
    let p = -2;
    while (q.length && q[0].time <= now) {
      const e = q.shift()!;
      if (e.beat !== undefined) b = e.beat;
      if (e.poly !== undefined) p = e.poly;
    }
    if (b !== -2) setCurrentBeat(b);
    if (p !== -2) setCurrentPoly(p);
    rafRef.current = requestAnimationFrame(draw);
  }

  // Anchor both layer clocks to a common start so they coincide on beat 1 / poly 1.
  function resetClocks() {
    const t0 = output().currentTime + 0.06;
    mainTime.current = t0;
    polyTime.current = t0;
    mainStep.current = 0;
    polyStep.current = 0;
    queueRef.current = [];
  }

  function start() {
    if (runningRef.current) return;
    resume();
    resetClocks();
    timerRef.current = setInterval(scheduler, TICK_MS);
    rafRef.current = requestAnimationFrame(draw);
    runningRef.current = true;
    setRunning(true);
  }

  function stop() {
    if (timerRef.current) clearInterval(timerRef.current);
    cancelAnimationFrame(rafRef.current);
    queueRef.current = [];
    runningRef.current = false;
    setRunning(false);
    setCurrentBeat(-1);
    setCurrentPoly(-1);
  }

  function toggle() {
    if (runningRef.current) stop();
    else start();
  }

  // Re-anchor the layers when a grid-defining setting changes mid-run, so the step counters never
  // reinterpret against a different meter/subdivision (tempo changes don't need this — the interval
  // just rescales). A brief realign at the next bar is fine for a practice tool.
  useEffect(() => {
    if (runningRef.current) resetClocks();
  }, [beats, subdiv, poly]);

  useEffect(
    () => () => {
      if (timerRef.current) clearInterval(timerRef.current);
      cancelAnimationFrame(rafRef.current);
    },
    [],
  );

  return { running, currentBeat, currentPoly, start, stop, toggle };
}
