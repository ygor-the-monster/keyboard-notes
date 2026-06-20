import { useEffect, useRef, useState } from "react";
import { toast } from "../Toasts/toasts.ts";
import { PitchDetector } from "pitchy";
import { useI18n } from "../../providers/I18nProvider/I18nProvider.tsx";
import { freqToNote, type NoteReading } from "../../utils/pitch/pitch.ts";

export interface TunerReading extends NoteReading {
  hz: number; // rounded, for display
  freq: number; // precise, for distance-to-target math
}

// Continuously-updated input signal, read by the expanded screen (on a low-rate interval) to drive
// the level meter and stability trace without re-rendering every animation frame.
export interface TunerSignal {
  level: number; // 0..1 input loudness (RMS, scaled)
  clarity: number; // 0..1 pitch confidence from pitchy
  cents: number | null; // deviation from the nearest note, or null when no clear pitch
}

// Live pitch detection from the microphone (via pitchy). `a4` is the reference pitch (e.g. 440 or
// 442). The Tuner keeps its own input AudioContext (closed on stop to free the mic).
export function useTuner(a4 = 440) {
  const { t } = useI18n();
  const [listening, setListening] = useState(false);
  const [reading, setReading] = useState<TunerReading | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef(0);
  const signalRef = useRef<TunerSignal>({ level: 0, clarity: 0, cents: null });
  const a4Ref = useRef(a4); // so changing the reference updates a live reading
  a4Ref.current = a4;

  const stop = () => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((tr) => tr.stop());
    ctxRef.current?.close().catch(() => {});
    ctxRef.current = null;
    streamRef.current = null;
    signalRef.current = { level: 0, clarity: 0, cents: null };
    setReading(null);
    setListening(false);
  };

  useEffect(() => () => stop(), []);

  async function start() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const Ctor =
        window.AudioContext ||
        (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext!;
      const ctx = new Ctor();
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
        // Input loudness (RMS) — drives the signal meter even when no clear pitch is found.
        let sumSq = 0;
        for (let i = 0; i < buf.length; i++) sumSq += buf[i] * buf[i];
        const level = Math.min(1, Math.sqrt(sumSq / buf.length) * 4);
        const [hz, clarity] = detector.findPitch(buf, ctx.sampleRate);
        const clear = clarity > 0.92 && hz > 40 && hz < 2000;
        if (clear) {
          const note = freqToNote(hz, a4Ref.current);
          setReading({ ...note, hz: Math.round(hz), freq: hz });
          signalRef.current = { level, clarity, cents: note.cents };
        } else {
          signalRef.current = { level, clarity, cents: null };
        }
        rafRef.current = requestAnimationFrame(loop);
      };
      rafRef.current = requestAnimationFrame(loop);
    } catch {
      toast.negative(t("audio.micUnavailableMsg"));
    }
  }

  return { listening, reading, signalRef, toggle: () => (listening ? stop() : start()) };
}
