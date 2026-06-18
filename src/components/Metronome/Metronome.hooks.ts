import { useEffect, useRef, useState } from "react";
import { output, resume, tone } from "../../utils/audioEngine/audioEngine.ts";

// Sample-accurate metronome using a Web Audio lookahead scheduler (the "Tale of Two Clocks"
// pattern): a coarse setInterval wakes up often and schedules click voices at exact context
// sample times, so timing never drifts the way a bare setInterval(60000/bpm) does. The clicks
// and the shared output context come from the audio engine.
const LOOKAHEAD_S = 0.1; // schedule clicks up to 100ms ahead
const TICK_MS = 25; // how often the scheduler wakes up

export function useMetronome({ bpm, beats }: { bpm: number; beats: number }) {
  const [running, setRunning] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const nextNoteTime = useRef(0);
  const beatRef = useRef(0);
  const runningRef = useRef(false);

  // Keep latest tempo/meter readable inside the scheduler without restarting it.
  const bpmRef = useRef(bpm);
  bpmRef.current = bpm || 90;
  const beatsRef = useRef(beats);
  beatsRef.current = beats || 4;

  function scheduler() {
    const now = output().currentTime;
    while (nextNoteTime.current < now + LOOKAHEAD_S) {
      const accent = beatRef.current % beatsRef.current === 0;
      tone({ when: nextNoteTime.current, freq: accent ? 1600 : 1000, gain: accent ? 0.5 : 0.32 });
      nextNoteTime.current += 60 / bpmRef.current;
      beatRef.current = (beatRef.current + 1) % beatsRef.current;
    }
  }

  function start() {
    if (runningRef.current) return;
    resume();
    beatRef.current = 0;
    nextNoteTime.current = output().currentTime + 0.06;
    timerRef.current = setInterval(scheduler, TICK_MS);
    runningRef.current = true;
    setRunning(true);
  }

  function stop() {
    if (timerRef.current) clearInterval(timerRef.current);
    runningRef.current = false;
    setRunning(false);
  }

  function toggle() {
    if (runningRef.current) stop();
    else start();
  }

  useEffect(
    () => () => {
      if (timerRef.current) clearInterval(timerRef.current);
    },
    [],
  );

  return { running, start, stop, toggle };
}
