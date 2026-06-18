import { useEffect, useRef, useState } from "react";
import { Button, DropZone, FileTrigger } from "@react-spectrum/s2";
import EmptyState from "../EmptyState/EmptyState.tsx";
import {
  PlayIcon as Play,
  PauseIcon as Pause,
  MicrophoneIcon as Microphone,
  StopIcon as Stop,
  UploadSimpleIcon as UploadSimple,
  ScissorsIcon as Scissors,
  TrashSimpleIcon as TrashSimple,
  ArrowUUpLeftIcon as ArrowUUpLeft,
  WaveformIcon as Waveform,
  MapPinIcon as MapPin,
  XIcon as X,
} from "@phosphor-icons/react";
import { useStore } from "../../providers/StoreProvider/StoreProvider.tsx";
import { useDialog } from "../../providers/DialogProvider/DialogProvider.tsx";
import { useI18n } from "../../providers/I18nProvider/I18nProvider.tsx";
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
  remapMarksAfterTrim,
  remapMarksAfterCut,
} from "./AudioCell.utils.js";
import { ANNOT_COLORS, withAlpha } from "../AnnotationLayer/AnnotationLayer.utils.ts";
import Toolbar from "../Toolbar/Toolbar.tsx";
import shared from "../../providers/ThemeProvider/ThemeProvider.module.css";
import { dropFull } from "./AudioCell.styled.jsx";
import css from "./AudioCell.module.css";

const BUCKETS = 600;
const EMPTY_MARKS = []; // stable reference so the waveform effect doesn't re-run each render
const uid = () => "m-" + Math.random().toString(36).slice(2, 9);

export default function AudioCell({ cell, editing }) {
  const { updateCell } = useStore();
  const { confirm, alert } = useDialog();
  const { t } = useI18n();
  const src = cell.dataUrl;
  const marks = cell.marks || EMPTY_MARKS;

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

    // Annotation marks: region bands (translucent) + point pins, each in its own colour.
    if (dur) {
      for (const m of marks) {
        const col = m.color || accent;
        if (m.kind === "region") {
          const rx = (m.time / dur) * w;
          const rw = Math.max(2, ((m.end - m.time) / dur) * w);
          ctx.fillStyle = withAlpha(col, 0.18);
          ctx.fillRect(rx, 0, rw, h);
          ctx.fillStyle = col;
          ctx.fillRect(rx, 0, 2, h);
          ctx.fillRect(rx + rw - 2, 0, 2, h);
          ctx.fillRect(rx, 0, rw, 4);
        } else {
          const px = (m.time / dur) * w;
          ctx.fillStyle = col;
          ctx.fillRect(px - 1, 0, 2, h);
          ctx.beginPath();
          ctx.moveTo(px - 5, 0);
          ctx.lineTo(px + 5, 0);
          ctx.lineTo(px, 7);
          ctx.closePath();
          ctx.fill();
        }
      }
    }
    // `editing` is a dep so the waveform redraws onto the fresh canvas node when the cell
    // switches between the editor and the compact view.
  }, [peaks, cur, dur, sel, editing, marks]);

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
  // Snapshots both audio bytes and marks so undo restores them together.
  async function commitAudio(dataUrl, nextMarks) {
    const sizeMB = (dataUrl.length * 0.75) / 1e6;
    if (sizeMB > 6) {
      const ok = await confirm({
        title: t("audio.largeTitle"),
        message: t("audio.largeMsg", { mb: sizeMB.toFixed(1) }),
        confirmLabel: t("common.keep"),
      });
      if (!ok) return;
    }
    historyRef.current.push({ dataUrl: src || "", marks });
    if (historyRef.current.length > 10) historyRef.current.shift();
    const patch = { dataUrl };
    if (nextMarks !== undefined) patch.marks = nextMarks;
    updateCell(cell.id, patch);
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
        title: t("audio.micUnavailableTitle"),
        message: t("audio.micUnavailableMsg"),
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
      alert({ title: t("audio.recordingFailedTitle"), message: e.message });
    }
  }

  async function upload(file) {
    if (!file || !file.type.startsWith("audio/")) return;
    commitAudio(await fileToDataUrl(file), []);
  }
  async function trimToSel() {
    if (!sel) return;
    const out = sliceBuffer(audioCtx(), await baseBuffer(), sel.start, sel.end);
    commitAudio(
      await fileToDataUrl(encodeWav(out)),
      remapMarksAfterTrim(marks, sel.start, sel.end),
    );
    setSel(null);
  }
  async function deleteSel() {
    if (!sel) return;
    const out = spliceBuffer(audioCtx(), await baseBuffer(), null, sel.start, sel.end);
    commitAudio(await fileToDataUrl(encodeWav(out)), remapMarksAfterCut(marks, sel.start, sel.end));
    setSel(null);
  }
  function undo() {
    const prev = historyRef.current.pop();
    if (prev != null) updateCell(cell.id, { dataUrl: prev.dataUrl, marks: prev.marks || [] });
  }

  // ---- annotation marks ------------------------------------------------------
  function addMark() {
    const color = ANNOT_COLORS[marks.length % ANNOT_COLORS.length].c;
    const m =
      sel && sel.end - sel.start > 0.05
        ? { id: uid(), kind: "region", time: sel.start, end: sel.end, color, label: "" }
        : { id: uid(), kind: "point", time: cur, color, label: "" };
    updateCell(cell.id, { marks: [...marks, m].sort((a, b) => a.time - b.time) });
    setSel(null);
  }
  const updateMark = (id, patch) =>
    updateCell(cell.id, { marks: marks.map((m) => (m.id === id ? { ...m, ...patch } : m)) });
  const deleteMark = (id) => updateCell(cell.id, { marks: marks.filter((m) => m.id !== id) });
  function cycleMarkColor(m) {
    const i = ANNOT_COLORS.findIndex((c) => c.c === m.color);
    updateMark(m.id, { color: ANNOT_COLORS[(i + 1) % ANNOT_COLORS.length].c });
  }
  function seekTo(time) {
    if (audioRef.current) audioRef.current.currentTime = time;
    setCur(time);
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
    if (!editing) return <EmptyState kind="audio" title={t("audio.noAudio")} compact />;
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
            <span className={shared.mediaEmptyTitle}>{t("audio.addTitle")}</span>
            <div className={css.emptyActions}>
              <Button variant="primary" onPress={toggleRec}>
                {recording ? t("audio.stopRecording") : t("audio.record")}
              </Button>
              <FileTrigger
                acceptedFileTypes={["audio/*"]}
                onSelect={(files) => files && upload(files[0])}
              >
                <Button>{t("common.browse")}</Button>
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
      label: t("audio.play"),
      altLabel: t("audio.pause"),
      value: playing,
      onToggle: togglePlay,
    },
    {
      kind: "spinner",
      id: "speed",
      label: t("audio.speed"),
      display: `${rate}×`,
      onPrev: () => changeRate(-0.25),
      onNext: () => changeRate(0.25),
      prevDisabled: rate <= 0.5,
      nextDisabled: rate >= 1.5,
    },
    { kind: "sep" },
    {
      kind: "action",
      id: "mark",
      icon: MapPin,
      label: t("audio.addMark"),
      onUse: addMark,
    },
    {
      kind: "toggle",
      id: "rec",
      icon: Microphone,
      altIcon: Stop,
      label: sel ? t("audio.recordSelection") : t("audio.recordCursor"),
      altLabel: t("audio.stopRecording"),
      value: recording,
      onToggle: toggleRec,
    },
    { kind: "sep" },
    {
      kind: "action",
      id: "trim",
      icon: Scissors,
      label: t("audio.trim"),
      onUse: trimToSel,
      disabled: !sel,
    },
    {
      kind: "action",
      id: "delsel",
      icon: TrashSimple,
      label: t("audio.deleteSelection"),
      onUse: deleteSel,
      disabled: !sel,
    },
    { kind: "sep" },
    {
      kind: "action",
      id: "replace",
      icon: UploadSimple,
      label: t("audio.replace"),
      onUse: () => fileRef.current?.click(),
    },
    { kind: "action", id: "undo", icon: ArrowUUpLeft, label: t("common.undo"), onUse: undo },
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
      {sel ? `  ·  ${t("audio.selection")} ${fmtTime(sel.start)}–${fmtTime(sel.end)}` : ""}
    </div>
  );

  const marksList = marks.length > 0 && (
    <ul className={css.marks}>
      {marks.map((m) => (
        <li key={m.id} className={css.markRow}>
          <button
            type="button"
            className={css.markSwatch}
            style={{ background: m.color }}
            onClick={() => editing && cycleMarkColor(m)}
            aria-label={t("audio.markColor")}
          />
          <button type="button" className={css.markTime} onClick={() => editing && seekTo(m.time)}>
            {m.kind === "region" ? `${fmtTime(m.time)}–${fmtTime(m.end)}` : fmtTime(m.time)}
          </button>
          {editing ? (
            <input
              className={css.markLabel}
              defaultValue={m.label}
              placeholder={t("audio.markPlaceholder")}
              onChange={(e) => updateMark(m.id, { label: e.target.value })}
            />
          ) : (
            <span className={css.markLabel}>{m.label}</span>
          )}
          {editing && (
            <button
              type="button"
              className={css.markDel}
              onClick={() => deleteMark(m.id)}
              aria-label={t("audio.deleteMark")}
            >
              <X size={14} aria-hidden />
            </button>
          )}
        </li>
      ))}
    </ul>
  );

  if (!editing) {
    // Compact view is display-only — clicking inside the cell switches to edit mode, so a
    // play control can't live here. Show the waveform + duration + any markers.
    return (
      <div className={css.col}>
        <div className={css.waveWrap}>
          <canvas ref={wfRef} className={`${css.canvas} ${css.readonly}`} />
        </div>
        {timeline}
        {marksList}
      </div>
    );
  }

  return (
    <div className={css.col}>
      {audioEl}
      <Toolbar label={t("cell.audio")} tools={tools} />
      <div className={css.waveWrap}>{waveform}</div>
      {timeline}
      {marksList}
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
