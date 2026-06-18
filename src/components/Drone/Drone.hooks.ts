import { useEffect, useRef, useState } from "react";
import { startTone, type Voice } from "../../audio/engine.ts";

// Note index (0 = C) + octave → frequency, via equal temperament around A4 = 440 Hz.
const freqOf = (noteIdx: number, octave: number): number =>
  440 * 2 ** (((octave + 1) * 12 + noteIdx - 69) / 12);

// Sustained reference pitch (drone) for intonation / ear-training. Wraps one engine Voice and
// keeps its frequency / volume in sync while sounding; click-free ramps live in the engine.
export function useDrone({
  note,
  octave,
  volume,
}: {
  note: number;
  octave: number;
  volume: number;
}) {
  const [playing, setPlaying] = useState(false);
  const voiceRef = useRef<Voice | null>(null);

  function start() {
    if (voiceRef.current) return;
    voiceRef.current = startTone({ freq: freqOf(note, octave), gain: volume });
    setPlaying(true);
  }
  function stop() {
    voiceRef.current?.stop();
    voiceRef.current = null;
    setPlaying(false);
  }
  const toggle = () => (voiceRef.current ? stop() : start());

  // Live-update frequency / volume while sounding.
  useEffect(() => {
    voiceRef.current?.setFrequency(freqOf(note, octave));
  }, [note, octave]);
  useEffect(() => {
    voiceRef.current?.setGain(volume);
  }, [volume]);

  // Stop the tone on unmount (immediate release).
  useEffect(() => () => voiceRef.current?.stop(0), []);

  return { playing, toggle };
}
