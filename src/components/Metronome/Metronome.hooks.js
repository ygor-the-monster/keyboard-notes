import { useEffect, useRef, useState } from "react";

// Sample-accurate metronome using a Web Audio lookahead scheduler
// (the "Tale of Two Clocks" pattern): a coarse setInterval wakes up often and
// schedules click oscillators at exact audioContext sample times, so timing
// never drifts the way a bare setInterval(60000/bpm) does.
const LOOKAHEAD_S = 0.1; // schedule notes up to 100ms ahead
const TICK_MS = 25; // how often the scheduler wakes up

export function useMetronome({ bpm, beats }) {
  const [running, setRunning] = useState(false);
  const ctxRef = useRef(null);
  const timerRef = useRef(null);
  const nextNoteTime = useRef(0);
  const beatRef = useRef(0);
  const runningRef = useRef(false);

  // Keep latest tempo/meter readable inside the scheduler without restarting it.
  const bpmRef = useRef(bpm);
  bpmRef.current = bpm || 90;
  const beatsRef = useRef(beats);
  beatsRef.current = beats || 4;

  function click(beat, time) {
    const ctx = ctxRef.current;
    const accent = beat % beatsRef.current === 0;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = accent ? 1600 : 1000;
    gain.gain.setValueAtTime(accent ? 0.5 : 0.32, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.05);
    osc.connect(gain).connect(ctx.destination);
    osc.start(time);
    osc.stop(time + 0.06);
  }

  function scheduler() {
    const ctx = ctxRef.current;
    while (nextNoteTime.current < ctx.currentTime + LOOKAHEAD_S) {
      click(beatRef.current, nextNoteTime.current);
      nextNoteTime.current += 60 / bpmRef.current;
      beatRef.current = (beatRef.current + 1) % beatsRef.current;
    }
  }

  function start() {
    if (runningRef.current) return;
    if (!ctxRef.current) ctxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    ctxRef.current.resume();
    beatRef.current = 0;
    nextNoteTime.current = ctxRef.current.currentTime + 0.06;
    timerRef.current = setInterval(scheduler, TICK_MS);
    runningRef.current = true;
    setRunning(true);
  }

  function stop() {
    clearInterval(timerRef.current);
    runningRef.current = false;
    setRunning(false);
  }

  function toggle() {
    if (runningRef.current) stop();
    else start();
  }

  useEffect(() => () => clearInterval(timerRef.current), []);

  return { running, start, stop, toggle };
}
