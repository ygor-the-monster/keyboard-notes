import { useEffect, useRef, useState } from "react";
import { startTone, type Voice } from "../../utils/audioEngine/audioEngine.ts";
import { midiToFreq } from "../../utils/pitch/pitch.ts";

// Sustained reference drone for intonation / ear-training. Layers one or more engine Voices (a
// chord) and keeps their frequency / volume in sync while sounding; click-free ramps live in the
// engine.

// Chord shapes as semitone offsets above the root. "fifth" (root+5th) is mode-neutral — good for
// practising any scale over it; the triad fixes major; tanpura adds the octave on top.
export const CHORD_OFFSETS: Record<string, number[]> = {
  root: [0],
  fifth: [0, 7],
  octave: [0, 12],
  triad: [0, 4, 7],
  tanpura: [0, 7, 12],
};
export const CHORD_IDS = ["root", "fifth", "octave", "triad", "tanpura"] as const;

// Timbre = the oscillator layers sounded per note (detune in cents). "warm" stacks slightly detuned
// voices for a fuller, tanpura-like shimmer that's pleasant to play over for a while.
interface Layer {
  type: OscillatorType;
  detune: number;
  gain: number;
}
const TIMBRES: Record<string, Layer[]> = {
  sine: [{ type: "sine", detune: 0, gain: 1 }],
  triangle: [{ type: "triangle", detune: 0, gain: 1 }],
  warm: [
    { type: "triangle", detune: -6, gain: 0.7 },
    { type: "sine", detune: 0, gain: 0.9 },
    { type: "triangle", detune: 7, gain: 0.6 },
  ],
};
export const TIMBRE_IDS = ["sine", "triangle", "warm"] as const;

interface DroneParams {
  note: number;
  octave: number;
  volume: number;
  chord: string;
  timbre: string;
  a4: number;
}

interface Spec {
  freq: number;
  type: OscillatorType;
  gain: number;
}

function buildSpecs({ note, octave, volume, chord, timbre, a4 }: DroneParams): Spec[] {
  const offsets = CHORD_OFFSETS[chord] ?? [0];
  const layers = TIMBRES[timbre] ?? TIMBRES.sine;
  const count = offsets.length * layers.length;
  const specs: Spec[] = [];
  for (const off of offsets) {
    const freq = midiToFreq((octave + 1) * 12 + note + off, a4);
    for (const l of layers) {
      // Split the user's volume across all sounded oscillators so chords don't clip.
      specs.push({
        freq: freq * 2 ** (l.detune / 1200),
        type: l.type,
        gain: ((volume * 0.6) / count) * l.gain,
      });
    }
  }
  return specs;
}

export function useDrone(params: DroneParams) {
  const { note, octave, volume, chord, timbre, a4 } = params;
  const [playing, setPlaying] = useState(false);
  const voicesRef = useRef<Voice[]>([]);
  const playingRef = useRef(false);
  const paramsRef = useRef(params);
  paramsRef.current = params;

  function spawn() {
    voicesRef.current = buildSpecs(paramsRef.current).map((s) => startTone(s));
  }
  function rebuild() {
    if (!playingRef.current) return;
    voicesRef.current.forEach((v) => v.stop());
    spawn();
  }
  function start() {
    if (playingRef.current) return;
    spawn();
    playingRef.current = true;
    setPlaying(true);
  }
  function stop() {
    voicesRef.current.forEach((v) => v.stop());
    voicesRef.current = [];
    playingRef.current = false;
    setPlaying(false);
  }
  const toggle = () => (playingRef.current ? stop() : start());

  // Note / octave / reference change → retune in place (voice count unchanged), so the drone glides
  // rather than clicking. Falls back to a rebuild if the layout somehow differs.
  useEffect(() => {
    if (!playingRef.current) return;
    const specs = buildSpecs(paramsRef.current);
    if (specs.length === voicesRef.current.length) {
      voicesRef.current.forEach((v, i) => v.setFrequency(specs[i].freq));
    } else {
      rebuild();
    }
  }, [note, octave, a4]);

  // Chord / timbre change the number of voices → rebuild.
  useEffect(() => {
    rebuild();
  }, [chord, timbre]);

  // Volume → live gain on each voice (no rebuild, so dragging the slider stays smooth).
  useEffect(() => {
    if (!playingRef.current) return;
    const specs = buildSpecs(paramsRef.current);
    voicesRef.current.forEach((v, i) => specs[i] && v.setGain(specs[i].gain));
  }, [volume]);

  // Stop on unmount (immediate release).
  useEffect(() => () => voicesRef.current.forEach((v) => v.stop(0)), []);

  return { playing, toggle };
}
