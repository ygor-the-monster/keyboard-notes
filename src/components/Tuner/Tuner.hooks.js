import { useEffect, useRef, useState } from "react";
import { PitchDetector } from "pitchy";

const NOTE_NAMES = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];

// Hz → { note, octave, cents } via the equal-tempered scale (A4 = 440).
export function hzToNote(hz) {
  const midi = 69 + 12 * Math.log2(hz / 440);
  const nearest = Math.round(midi);
  return {
    note: NOTE_NAMES[((nearest % 12) + 12) % 12],
    octave: Math.floor(nearest / 12) - 1,
    cents: Math.round((midi - nearest) * 100),
  };
}

// Live pitch detection from the microphone (via pitchy). Returns { listening, toggle,
// reading } where reading is { note, octave, cents, hz } | null.
export function useTuner() {
  const [listening, setListening] = useState(false);
  const [reading, setReading] = useState(null);
  const ctxRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(0);

  const stop = () => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    ctxRef.current?.close().catch(() => {});
    ctxRef.current = null;
    streamRef.current = null;
    setReading(null);
    setListening(false);
  };

  useEffect(() => () => stop(), []);

  async function start() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);
      streamRef.current = stream;
      ctxRef.current = ctx;
      const detector = PitchDetector.forFloat32Array(analyser.fftSize);
      detector.minVolumeDecibels = -30;
      const buf = new Float32Array(detector.inputLength);
      setListening(true);
      const loop = () => {
        analyser.getFloatTimeDomainData(buf);
        const [hz, clarity] = detector.findPitch(buf, ctx.sampleRate);
        if (clarity > 0.92 && hz > 40 && hz < 2000) {
          setReading({ ...hzToNote(hz), hz: Math.round(hz) });
        }
        rafRef.current = requestAnimationFrame(loop);
      };
      rafRef.current = requestAnimationFrame(loop);
    } catch {
      alert("Microphone unavailable or permission denied.");
    }
  }

  return { listening, reading, toggle: () => (listening ? stop() : start()) };
}
