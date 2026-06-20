import { useEffect, useRef, useState } from "react";
import { output, resume, tone } from "../../utils/audioEngine/audioEngine.ts";

// Sample-accurate metronome using a Web Audio lookahead scheduler (the "Tale of Two Clocks"
// pattern): a coarse setInterval wakes up often and schedules click voices at exact context
// sample times, so timing never drifts the way a bare setInterval(60000/bpm) does. The clicks
// and the shared output context come from the audio engine. A requestAnimationFrame loop reads the
// same context clock to surface the *currently sounding* beat, so the visual indicator stays in
// sync with what you hear (not with when it was scheduled, ~100ms early).
const LOOKAHEAD_S = 0.1; // schedule clicks up to 100ms ahead
const TICK_MS = 25; // how often the scheduler wakes up

// Per-beat accent level. 0 = muted, 1 = weak (normal click), 2 = strong (accent).
export type AccentLevel = 0 | 1 | 2;

// A sound preset: the oscillator voice for weak vs strong beats.
export interface ToneSpec {
  accent: { freq: number; type: OscillatorType };
  beat: { freq: number; type: OscillatorType };
}

export function useMetronome({
  bpm,
  beats,
  pattern,
  sound,
}: {
  bpm: number;
  beats: number;
  pattern: AccentLevel[];
  sound: ToneSpec;
}) {
  const [running, setRunning] = useState(false);
  const [currentBeat, setCurrentBeat] = useState(-1);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const rafRef = useRef(0);
  const nextNoteTime = useRef(0);
  const beatRef = useRef(0);
  const runningRef = useRef(false);
  // Beats scheduled but not yet sounded — drained by the rAF loop to drive the visual indicator.
  const queueRef = useRef<{ beat: number; time: number }[]>([]);

  // Keep latest tempo/meter/pattern/sound readable inside the scheduler without restarting it.
  const bpmRef = useRef(bpm);
  bpmRef.current = bpm || 90;
  const beatsRef = useRef(beats);
  beatsRef.current = beats || 4;
  const patternRef = useRef(pattern);
  patternRef.current = pattern;
  const soundRef = useRef(sound);
  soundRef.current = sound;

  function scheduler() {
    const now = output().currentTime;
    // Drop beats that already passed unseen (e.g. while backgrounded, when rAF is paused) so the
    // queue can't grow without bound and the indicator catches up to the present on return.
    const q = queueRef.current;
    while (q.length && q[0].time < now - 0.2) q.shift();

    while (nextNoteTime.current < now + LOOKAHEAD_S) {
      const beat = beatRef.current;
      const level = patternRef.current[beat] ?? 1;
      if (level > 0) {
        const voice = level === 2 ? soundRef.current.accent : soundRef.current.beat;
        tone({
          when: nextNoteTime.current,
          freq: voice.freq,
          type: voice.type,
          gain: level === 2 ? 0.5 : 0.32,
        });
      }
      q.push({ beat, time: nextNoteTime.current });
      nextNoteTime.current += 60 / bpmRef.current;
      beatRef.current = (beatRef.current + 1) % beatsRef.current;
    }
  }

  // Advance the displayed beat the instant its scheduled context time arrives.
  function draw() {
    const now = output().currentTime;
    const q = queueRef.current;
    let cur = -2; // sentinel: nothing new this frame
    while (q.length && q[0].time <= now) cur = q.shift()!.beat;
    if (cur !== -2) setCurrentBeat(cur);
    rafRef.current = requestAnimationFrame(draw);
  }

  function start() {
    if (runningRef.current) return;
    resume();
    beatRef.current = 0;
    queueRef.current = [];
    nextNoteTime.current = output().currentTime + 0.06;
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
  }

  function toggle() {
    if (runningRef.current) stop();
    else start();
  }

  useEffect(
    () => () => {
      if (timerRef.current) clearInterval(timerRef.current);
      cancelAnimationFrame(rafRef.current);
    },
    [],
  );

  return { running, currentBeat, start, stop, toggle };
}
