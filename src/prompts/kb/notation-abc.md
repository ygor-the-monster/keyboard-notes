---
title: Notation in this app — ABC and chord charts
topics: ABC notation, staff notation, score cell, header fields, key, meter, note length, octaves, rests, barlines, chord chart, cifra, lyrics
source: Keyboard Notes (original)
license: project
---

## What this app engraves
This app writes engraved staves from ABC notation in its Score cells, and renders text chord charts in its Cifra (chord-chart) cells. When a learner asks how to write something on the staff here, answer in ABC; when they ask about a chord chart, answer in plain chord-over-lyric text.

## ABC header fields
An ABC tune starts with header fields, one per line: X: the tune number (X:1), T: the title, C: the composer, M: the meter (M:4/4, or M:C for common time), L: the default note length (L:1/4 means a bare letter is a quarter note; L:1/8 an eighth), Q: the tempo (Q:1/4=120), and K: the key, which also ends the header (K:C, K:Gm, K:D). Everything after K: is music.

## ABC pitches and octaves
Letters C D E F G A B are the notes of the octave starting at middle C. Lowercase c d e f g a b are the octave above. A comma lowers an octave (C, is below middle C) and an apostrophe raises one (c' is high). Accidentals go before the note: ^ is sharp (^F = F#), _ is flat (_B = Bb), = is natural. The key signature applies automatically, so you only mark accidentals that depart from it.

## ABC durations and rests
With the default length set by L:, a number multiplies and a slash divides: C2 is twice the default length, C/ or C/2 is half, C3/2 is dotted. A rest is z (visible) or x (invisible); Z is a multi-measure rest. So in L:1/8, "C2 D2 E4" is two eighths' worth, two eighths' worth, then a half-note's worth.

## ABC barlines and repeats
A single barline is |, a final barline |], a double barline ||. Repeats use |: to start and :| to end; first and second endings are written [1 and [2 after the repeat. Example: |: C D E F :| repeats that bar.

## A minimal ABC example
A full simple tune:
X:1
T:C major scale
M:4/4
L:1/4
K:C
C D E F | G A B c |
This engraves an ascending C major scale across two bars.

## ABC chords, ties, and lyrics
Notes played together (a chord) go in square brackets: [CEG] is a C major triad. A tie is a hyphen between two notes of the same pitch (C- C). Chord symbols above the staff go in double quotes before the note: "C"C "G7"G. Lyrics go on a w: line below the music, with syllables aligned to notes: w: Twin-kle twin-kle.

## Chord charts (Cifra cells)
A chord chart is plain text with chord names placed above the words, the format used on lead sheets and songbook/"cifra" sites. Write the chord names on their own line directly above the lyric line they apply to, lining up each chord over the syllable where it changes. The app reads standard chord symbols (C, Am, G7, Dsus4, F/C) and can transpose the whole chart up or down by semitones, so you write it once in any key.
