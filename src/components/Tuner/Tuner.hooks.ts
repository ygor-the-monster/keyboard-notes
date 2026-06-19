import { useEffect, useRef, useState } from "react";
import { toast } from "../Toasts/toasts.ts";
import { PitchDetector } from "pitchy";
import { useI18n } from "../../providers/I18nProvider/I18nProvider.tsx";
import { freqToNote, type NoteReading } from "../../utils/pitch/pitch.ts";

export interface TunerReading extends NoteReading {
  hz: number;
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
  const a4Ref = useRef(a4); // so changing the reference updates a live reading
  a4Ref.current = a4;

  const stop = () => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((tr) => tr.stop());
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
        const [hz, clarity] = detector.findPitch(buf, ctx.sampleRate);
        if (clarity > 0.92 && hz > 40 && hz < 2000) {
          setReading({ ...freqToNote(hz, a4Ref.current), hz: Math.round(hz) });
        }
        rafRef.current = requestAnimationFrame(loop);
      };
      rafRef.current = requestAnimationFrame(loop);
    } catch {
      toast.negative(t("audio.micUnavailableMsg"));
    }
  }

  return { listening, reading, toggle: () => (listening ? stop() : start()) };
}
