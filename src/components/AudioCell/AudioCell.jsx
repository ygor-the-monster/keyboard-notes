import { useEffect, useRef, useState } from "react";
import { Button, DropZone, FileTrigger, Text } from "@react-spectrum/s2";
import {
  Play,
  Pause,
  Microphone,
  Stop,
  UploadSimple,
  Scissors,
  TrashSimple,
  ArrowUUpLeft,
  Waveform,
} from "@phosphor-icons/react";
import { useStore } from "../../providers/StoreProvider/StoreProvider.jsx";
import { useDialog } from "../../providers/DialogProvider/DialogProvider.jsx";
import {
  fileToDataUrl,
  audioCtx,
  decodeDataUrl,
  decodeBlob,
  computePeaks,
  spliceBuffer,
  sliceBuffer,
  encodeWav,
  fmtTime,
} from "./AudioCell.utils.js";
import Toolbar from "../Toolbar/Toolbar.jsx";
import shared from "../../providers/ThemeProvider/ThemeProvider.module.css";
import { dropFull } from "./AudioCell.styled.jsx";
import css from "./AudioCell.module.css";

const BUCKETS = 600;

export default function AudioCell({ cell, editing }) {
  const { updateCell } = useStore();
  const { confirm, alert } = useDialog();
  const src = cell.dataUrl;

  const audioRef = useRef(null);
  const wfRef = useRef(null);
  const fileRef = useRef(null);
  const recRef = useRef(null); // MediaRecorder
  const chunksRef = useRef([]);
  const punchRef = useRef(null); // region being re-recorded over
  const bufRef = useRef(null); // decoded AudioBuffer (for splicing)
  const historyRef = useRef([]);
  const dragRef = useRef(null);

  const [playing, setPlaying] = useState(false);
  const [recording, setRecording] = useState(false);
  const [cur, setCur] = useState(0);
  const [dur, setDur] = useState(0);
  const [rate, setRate] = useState(1);
  const [peaks, setPeaks] = useState(null);
  const [sel, setSel] = useState(null); // { start, end } in seconds

  // Decode + compute waveform peaks whenever the audio changes.
  useEffect(() => {
    if (!src) {
      setPeaks(null);
      bufRef.current = null;
      setDur(0);
      return;
    }
    let cancelled = false;
    decodeDataUrl(src)
      .then((buf) => {
        if (cancelled) return;
        bufRef.current = buf;
        setDur(buf.duration);
        setPeaks(computePeaks(buf, BUCKETS));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [src]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = rate;
  }, [rate, src]);

  // Draw the waveform (played portion + selection + cursor) in the cell's accent colour.
  useEffect(() => {
    const cv = wfRef.current;
    if (!cv || !peaks) return;
    const w = cv.clientWidth || 600;
    const h = cv.clientHeight || 72;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = w * dpr;
    cv.height = h * dpr;
    const ctx = cv.getContext("2d");
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);
    const accent = getComputedStyle(cv).getPropertyValue("--accent").trim() || "rgb(154,71,226)";
    const mid = h / 2;
    const n = peaks.length;
    const bw = w / n;
    const progX = dur ? (cur / dur) * w : 0;
    if (sel && dur) {
      ctx.fillStyle = "rgba(154,71,226,0.13)";
      ctx.fillRect((sel.start / dur) * w, 0, ((sel.end - sel.start) / dur) * w, h);
    }
    for (let i = 0; i < n; i++) {
      const x = i * bw;
      const amp = Math.max(0.5, peaks[i] * mid * 0.92);
      ctx.fillStyle = x <= progX ? accent : "rgba(19,19,19,0.22)";
      ctx.fillRect(x, mid - amp, Math.max(1, bw - 0.5), amp * 2);
    }
    ctx.fillStyle = accent;
    ctx.fillRect(progX - 1, 0, 2, h);
    // `editing` is a dep so the waveform redraws onto the fresh canvas node when the cell
    // switches between the editor and the compact view.
  }, [peaks, cur, dur, sel, editing]);

  // ---- playback --------------------------------------------------------------
  function togglePlay() {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) a.play();
    else a.pause();
  }
  function changeRate(d) {
    setRate((r) => Math.min(1.5, Math.max(0.5, +(r + d).toFixed(2))));
  }

  // ---- editing (commit + history) -------------------------------------------
  async function commitAudio(dataUrl) {
    const sizeMB = (dataUrl.length * 0.75) / 1e6;
    if (sizeMB > 6) {
      const ok = await confirm({
        title: "Large clip",
        message: `This clip is ~${sizeMB.toFixed(1)} MB and may strain local storage. Keep it?`,
        confirmLabel: "Keep",
      });
      if (!ok) return;
    }
    historyRef.current.push(src || "");
    if (historyRef.current.length > 10) historyRef.current.shift();
    updateCell(cell.id, { dataUrl });
  }
  async function baseBuffer() {
    return bufRef.current || (await decodeDataUrl(src));
  }

  // ---- record / re-record ----------------------------------------------------
  async function toggleRec() {
    if (recording) {
      recRef.current?.stop();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => e.data.size && chunksRef.current.push(e.data);
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        finishRec();
      };
      recRef.current = rec;
      // Punch-in region: the selection, else from the cursor to the end. Null = fresh clip.
      punchRef.current = src ? (sel ? { ...sel } : { start: cur, end: dur }) : null;
      rec.start();
      setRecording(true);
    } catch {
      alert({
        title: "Microphone unavailable",
        message: "Permission denied or no microphone found.",
      });
    }
  }
  async function finishRec() {
    setRecording(false);
    const chunks = chunksRef.current;
    if (!chunks.length) return;
    const blob = new Blob(chunks, { type: chunks[0].type || "audio/webm" });
    if (!src) {
      commitAudio(await fileToDataUrl(blob)); // fresh clip — keep it compressed
      return;
    }
    try {
      const ctx = audioCtx();
      const base = await baseBuffer();
      const ins = await decodeBlob(blob);
      const r = punchRef.current || { start: 0, end: base.duration };
      const out = spliceBuffer(ctx, base, ins, r.start, r.end);
      commitAudio(await fileToDataUrl(encodeWav(out)));
      setSel(null);
    } catch (e) {
      alert({ title: "Recording failed", message: e.message });
    }
  }

  async function upload(file) {
    if (!file || !file.type.startsWith("audio/")) return;
    commitAudio(await fileToDataUrl(file));
  }
  async function trimToSel() {
    if (!sel) return;
    const out = sliceBuffer(audioCtx(), await baseBuffer(), sel.start, sel.end);
    commitAudio(await fileToDataUrl(encodeWav(out)));
    setSel(null);
  }
  async function deleteSel() {
    if (!sel) return;
    const out = spliceBuffer(audioCtx(), await baseBuffer(), null, sel.start, sel.end);
    commitAudio(await fileToDataUrl(encodeWav(out)));
    setSel(null);
  }
  function undo() {
    const prev = historyRef.current.pop();
    if (prev != null) updateCell(cell.id, { dataUrl: prev });
  }

  // ---- waveform pointer (seek / select region) -------------------------------
  function xToTime(e) {
    const r = wfRef.current.getBoundingClientRect();
    return Math.max(0, Math.min(dur, ((e.clientX - r.left) / r.width) * dur));
  }
  function onDown(e) {
    if (!dur) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    dragRef.current = { t0: xToTime(e), moved: false };
  }
  function onMove(e) {
    const d = dragRef.current;
    if (!d) return;
    const t = xToTime(e);
    if (editing && Math.abs(t - d.t0) > 0.05) {
      d.moved = true;
      setSel({ start: Math.min(d.t0, t), end: Math.max(d.t0, t) });
    }
  }
  function onUp() {
    const d = dragRef.current;
    dragRef.current = null;
    if (!d || d.moved) return;
    if (audioRef.current) audioRef.current.currentTime = d.t0;
    setCur(d.t0);
    setSel(null);
  }

  const audioEl = (
    <audio
      ref={audioRef}
      src={src || undefined}
      preload="metadata"
      hidden
      onLoadedMetadata={(e) => isFinite(e.target.duration) && setDur(e.target.duration)}
      onTimeUpdate={(e) => setCur(e.target.currentTime)}
      onPlay={() => setPlaying(true)}
      onPause={() => setPlaying(false)}
      onEnded={() => setPlaying(false)}
    />
  );

  // ---- empty state -----------------------------------------------------------
  if (!src) {
    if (!editing) return <Text>No audio — click to record or add one.</Text>;
    return (
      <div className={css.col}>
        {audioEl}
        <DropZone
          onDrop={async (e) => {
            const f = e.items.find((i) => i.kind === "file");
            if (f) upload(await f.getFile());
          }}
          styles={dropFull}
        >
          <div className={shared.mediaEmpty}>
            <Waveform size={40} aria-hidden />
            <span className={shared.mediaEmptyTitle}>Record or add audio</span>
            <div className={css.emptyActions}>
              <Button variant="primary" onPress={toggleRec}>
                {recording ? "Stop recording" : "Record"}
              </Button>
              <FileTrigger
                acceptedFileTypes={["audio/*"]}
                onSelect={(files) => files && upload(files[0])}
              >
                <Button>Browse…</Button>
              </FileTrigger>
            </div>
          </div>
        </DropZone>
      </div>
    );
  }

  const tools = [
    {
      kind: "toggle",
      id: "play",
      icon: Play,
      altIcon: Pause,
      label: "Play",
      altLabel: "Pause",
      value: playing,
      onToggle: togglePlay,
    },
    {
      kind: "spinner",
      id: "speed",
      label: "Speed",
      display: `${rate}×`,
      onPrev: () => changeRate(-0.25),
      onNext: () => changeRate(0.25),
      prevDisabled: rate <= 0.5,
      nextDisabled: rate >= 1.5,
    },
    { kind: "sep" },
    {
      kind: "toggle",
      id: "rec",
      icon: Microphone,
      altIcon: Stop,
      label: sel ? "Re-record selection" : "Re-record from cursor",
      altLabel: "Stop recording",
      value: recording,
      onToggle: toggleRec,
    },
    { kind: "sep" },
    {
      kind: "action",
      id: "trim",
      icon: Scissors,
      label: "Trim to selection",
      onUse: trimToSel,
      disabled: !sel,
    },
    {
      kind: "action",
      id: "delsel",
      icon: TrashSimple,
      label: "Delete selection",
      onUse: deleteSel,
      disabled: !sel,
    },
    { kind: "sep" },
    {
      kind: "action",
      id: "replace",
      icon: UploadSimple,
      label: "Replace audio",
      onUse: () => fileRef.current?.click(),
    },
    { kind: "action", id: "undo", icon: ArrowUUpLeft, label: "Undo", onUse: undo },
  ];

  const waveform = (
    <canvas
      ref={wfRef}
      className={css.canvas}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
    />
  );
  const timeline = (
    <div className={css.time}>
      {fmtTime(cur)} / {fmtTime(dur)}
      {sel ? `  ·  selection ${fmtTime(sel.start)}–${fmtTime(sel.end)}` : ""}
    </div>
  );

  if (!editing) {
    // Compact view is display-only — clicking inside the cell switches to edit mode, so a
    // play control can't live here. Show the waveform + duration; play from the editor.
    return (
      <div className={css.col}>
        <div className={css.waveWrap}>
          <canvas ref={wfRef} className={`${css.canvas} ${css.readonly}`} />
        </div>
        {timeline}
      </div>
    );
  }

  return (
    <div className={css.col}>
      {audioEl}
      <Toolbar label="Audio" tools={tools} />
      <div className={css.waveWrap}>{waveform}</div>
      {timeline}
      <input
        ref={fileRef}
        type="file"
        accept="audio/*"
        hidden
        onChange={(e) => {
          const f = e.target.files[0];
          e.target.value = "";
          if (f) upload(f);
        }}
      />
    </div>
  );
}
