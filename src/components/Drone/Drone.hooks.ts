import { useEffect, useRef, useState } from "react";
import { startTone, type Voice } from "../../utils/audioEngine/audioEngine.ts";
import { noteToFreq } from "../../utils/pitch/pitch.ts";

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
    voiceRef.current = startTone({ freq: noteToFreq(note, octave), gain: volume });
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
    voiceRef.current?.setFrequency(noteToFreq(note, octave));
  }, [note, octave]);
  useEffect(() => {
    voiceRef.current?.setGain(volume);
  }, [volume]);

  // Stop the tone on unmount (immediate release).
  useEffect(() => () => voiceRef.current?.stop(0), []);

  return { playing, toggle };
}
