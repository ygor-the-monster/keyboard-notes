import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "react-aria-components";
import {
  BroadcastIcon as Broadcast,
  PaperPlaneTiltIcon as PaperPlaneTilt,
  DownloadSimpleIcon as DownloadSimple,
  QrCodeIcon as QrCode,
  CameraIcon as Camera,
} from "@phosphor-icons/react";
import { useRoute } from "../../providers/RouteProvider/RouteProvider.tsx";
import { useStore } from "../../providers/StoreProvider/StoreProvider.tsx";
import { useI18n } from "../../providers/I18nProvider/I18nProvider.tsx";
import { useDialog } from "../../providers/DialogProvider/DialogProvider.tsx";
import { toast } from "../Toasts/toasts.ts";
import { serializeLesson } from "../../utils/lessonExport/lessonExport.ts";
import {
  BeamSender,
  BeamReceiver,
  type BeamEvents,
  type BeamPhase,
} from "../../utils/localBeam/beamPeer.ts";
import { formatSafetyCode } from "../../utils/localBeam/safetyCode.ts";
import ToolScreen from "../ToolScreen/ToolScreen.tsx";
import { encodeQr, scanQr, type QrScanner } from "./qr.ts";
import s from "./BeamScreen.module.css";

export const BEAM_SCREEN = "beam";

// Outer gate (mounted always, like LibraryScreen): render the flow only while on `#beam`, so all the
// WebRTC/camera state lives in a child that mounts fresh on open and tears down cleanly on close.
export default function BeamScreen() {
  const { screen, closeScreen } = useRoute();
  if (screen !== BEAM_SCREEN) return null;
  return <BeamFlow onClose={closeScreen} />;
}

type Mode = null | "send" | "receive";

function BeamFlow({ onClose }: { onClose: () => void }) {
  const { activeLesson, importLesson } = useStore();
  const { confirm } = useDialog();
  const { t } = useI18n();

  const [mode, setMode] = useState<Mode>(null);
  const [useStun, setUseStun] = useState(true);
  const [phase, setPhase] = useState<BeamPhase>("idle");
  const [qrText, setQrText] = useState<string | null>(null); // the code to display as a QR
  const [safety, setSafety] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  // When set, the scanner is live; the stored fn receives the decoded code once.
  const [scanFor, setScanFor] = useState<null | ((code: string) => void)>(null);

  const peerRef = useRef<BeamSender | BeamReceiver | null>(null);
  const scannerRef = useRef<QrScanner | null>(null);
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Tear down the peer + camera when the flow unmounts (screen closed / navigated away).
  useEffect(
    () => () => {
      peerRef.current?.close();
      scannerRef.current?.stop();
    },
    [],
  );

  const events = useMemo<BeamEvents>(
    () => ({
      onPhase: setPhase,
      onProgress: setProgress,
      onSafetyCode: setSafety,
      onError: (e) => setError(e.message),
    }),
    [],
  );

  // Drive the camera scanner whenever a scan is requested and the <video> is mounted.
  useEffect(() => {
    if (!scanFor || !videoRef.current) return;
    let active = true;
    void scanQr(
      videoRef.current,
      (code) => {
        setScanFor(null);
        scanFor(code);
      },
      () => {
        setScanFor(null);
        setError(t("beam.errCamera"));
      },
    ).then((sc) => {
      if (active) {
        scannerRef.current = sc;
      } else {
        sc.stop();
      }
    });
    return () => {
      active = false;
      scannerRef.current?.stop();
      scannerRef.current = null;
    };
  }, [scanFor, t]);

  // Paint the QR whenever the code to show changes.
  useEffect(() => {
    if (qrText && qrCanvasRef.current) {
      encodeQr(qrText, qrCanvasRef.current).catch(() => setError(t("beam.errQr")));
    }
  }, [qrText, t]);

  const requestScan = (onCode: (code: string) => void) => setScanFor(() => onCode);

  async function startSend() {
    if (!activeLesson) return;
    setMode("send");
    setError(null);
    const sender = new BeamSender(events, useStun);
    sender.setPayload(serializeLesson(activeLesson), activeLesson.title || t("topbar.untitled"));
    peerRef.current = sender;
    try {
      setQrText(await sender.createOffer());
    } catch (e) {
      setError((e as Error).message);
    }
  }

  function startReceive() {
    setMode("receive");
    setError(null);
    const receiver = new BeamReceiver({ ...events, onReceived: handleReceived }, useStun);
    peerRef.current = receiver;
    requestScan(async (code) => {
      try {
        setQrText(await receiver.acceptOffer(code));
      } catch (e) {
        setError((e as Error).message);
      }
    });
  }

  async function handleReceived(result: { title: string; json: string }) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(result.json);
    } catch {
      return setError(t("beam.errCorrupt"));
    }
    const ok = await confirm({
      title: t("beam.confirmTitle", { title: result.title || t("topbar.untitled") }),
      message: t("beam.confirmMsg"),
      confirmLabel: t("beam.confirmAccept"),
    });
    if (!ok) return onClose();
    try {
      const { dropped } = importLesson(parsed);
      toast.positive(t("beam.received"));
      if (dropped > 0) toast.neutral(t("toast.importDropped", { count: dropped }));
      onClose();
    } catch {
      setError(t("beam.errCorrupt"));
    }
  }

  const phaseLabel = phase === "idle" ? null : t(`beam.phase_${phase}`);

  const scanning = scanFor !== null;

  return (
    <ToolScreen title={t("beam.title")} icon={Broadcast} accent="--s-silver" onClose={onClose}>
      <div className={s.beam}>
        {error && (
          <div className={s.error} role="alert">
            {error}
          </div>
        )}

        {mode === null && (
          <div className={s.chooser}>
            <p className={s.lead}>{t("beam.lead")}</p>
            <div className={s.roles}>
              <button
                type="button"
                className={s.role}
                onClick={startSend}
                disabled={!activeLesson}
              >
                <PaperPlaneTilt size={28} aria-hidden />
                <span className={s.roleName}>{t("beam.send")}</span>
                <span className={s.roleHint}>
                  {activeLesson
                    ? t("beam.sendHint", { title: activeLesson.title || t("topbar.untitled") })
                    : t("beam.noLesson")}
                </span>
              </button>
              <button type="button" className={s.role} onClick={startReceive}>
                <DownloadSimple size={28} aria-hidden />
                <span className={s.roleName}>{t("beam.receive")}</span>
                <span className={s.roleHint}>{t("beam.receiveHint")}</span>
              </button>
            </div>
            <label className={s.stunToggle}>
              <input
                type="checkbox"
                checked={!useStun}
                onChange={(e) => setUseStun(!e.target.checked)}
              />
              {t("beam.lanOnly")}
            </label>
          </div>
        )}

        {mode !== null && (
          <div className={s.flow}>
            {phaseLabel && <p className={s.status}>{phaseLabel}</p>}

            {/* The QR to show the other device. */}
            {qrText && phase !== "transferring" && phase !== "done" && (
              <div className={s.qrBlock}>
                <p className={s.instruction}>
                  <QrCode size={18} aria-hidden />{" "}
                  {mode === "send" ? t("beam.showOffer") : t("beam.showAnswer")}
                </p>
                <canvas ref={qrCanvasRef} className={s.qr} width={320} height={320} />
                {mode === "send" && (
                  <Button className={s.scanBtn} onPress={() => requestScan(acceptAnswerScan)}>
                    <Camera size={18} aria-hidden /> {t("beam.scanAnswer")}
                  </Button>
                )}
              </div>
            )}

            {/* Live camera while scanning. */}
            {scanning && (
              <div className={s.scanBlock}>
                <p className={s.instruction}>
                  <Camera size={18} aria-hidden />{" "}
                  {mode === "send" ? t("beam.scanAnswer") : t("beam.scanOffer")}
                </p>
                <video ref={videoRef} className={s.video} muted playsInline />
              </div>
            )}

            {(phase === "transferring" || phase === "done") && (
              <div className={s.progressBlock}>
                <div className={s.progressTrack}>
                  <div className={s.progressFill} style={{ width: `${Math.round(progress * 100)}%` }} />
                </div>
                <span className={s.progressPct}>{Math.round(progress * 100)}%</span>
              </div>
            )}

            {safety && (
              <p className={s.safety}>
                {t("beam.safety")} <strong>{formatSafetyCode(safety)}</strong>
              </p>
            )}

            <Button className={s.cancel} onPress={onClose}>
              {t("common.cancel")}
            </Button>
          </div>
        )}
      </div>
    </ToolScreen>
  );

  // Defined after render-scope closures so it can call into peerRef.
  function acceptAnswerScan(code: string) {
    const sender = peerRef.current;
    if (sender instanceof BeamSender) {
      sender.acceptAnswer(code).catch((e) => setError((e as Error).message));
    }
  }
}
