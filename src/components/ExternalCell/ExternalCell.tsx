import { useEffect, useState, type ReactNode } from "react";
import { Button } from "react-aria-components";
import {
  ArrowSquareOutIcon as ArrowSquareOut,
  GlobeIcon as Globe,
  YoutubeLogoIcon as YoutubeLogo,
  SpotifyLogoIcon as SpotifyLogo,
  SoundcloudLogoIcon as SoundcloudLogo,
  GoogleDriveLogoIcon as GoogleDriveLogo,
  VideoCameraIcon as VideoCamera,
  MusicNotesIcon as MusicNotes,
  MapTrifoldIcon as MapTrifold,
  PresentationIcon as Presentation,
} from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";
import EmptyState from "../EmptyState/EmptyState.tsx";
import { useStore } from "../../providers/StoreProvider/StoreProvider.tsx";
import { useI18n } from "../../providers/I18nProvider/I18nProvider.tsx";
import { onSeek } from "../../utils/seekBus/seekBus.ts";
import type { CellOf } from "../../utils/cellKinds/cellKinds.ts";
import {
  detectProvider,
  fetchMeta,
  deriveTitle,
  isSeekableProvider,
  seekableSrc,
  type ProviderId,
} from "./ExternalCell.utils.ts";
import shared from "../../providers/ThemeProvider/ThemeProvider.module.css";
import offlineArt from "./illustrations/offline.svg";
import css from "./ExternalCell.module.css";

// External is the one kind that can't render offline (it holds no bytes on device), so it degrades
// to a placeholder card: this illustration, a message, and the raw link.

// Brand marks where Phosphor ships one; sensible generics (by category) where it doesn't.
const PROVIDER_ICON: Record<ProviderId, Icon> = {
  youtube: YoutubeLogo,
  vimeo: VideoCamera,
  spotify: SpotifyLogo,
  deezer: MusicNotes,
  soundcloud: SoundcloudLogo,
  googledrive: GoogleDriveLogo,
  googlemaps: MapTrifold,
  slideshare: Presentation,
};

// Track the connection so the embed can fall back to a placeholder when there's no network.
function useOnline(): boolean {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return online;
}

// For generic pages / providers without a deterministic embed: attempt to iframe the URL, and fall
// back to the link card if it never loads. Browsers don't reliably report X-Frame-Options/CSP frame
// blocks (a refused frame often still fires onLoad), so a load timeout catches hard failures and the
// always-present footer link is the escape hatch for a frame that "loaded" but refused to render.
function AttemptFrame({
  url,
  title,
  chip,
  fallback,
}: {
  url: string;
  title: string;
  chip: ReactNode;
  fallback: ReactNode;
}) {
  const [status, setStatus] = useState<"loading" | "ok" | "failed">("loading");
  useEffect(() => {
    setStatus("loading");
    const timer = setTimeout(() => setStatus((s) => (s === "loading" ? "failed" : s)), 4000);
    return () => clearTimeout(timer);
  }, [url]);

  if (status === "failed") return <>{fallback}</>;
  return (
    <div className={css.embedWrap}>
      {chip}
      <div className={`${css.frameWrap} ${css.pageFrame}`} style={{ height: 480 }}>
        <iframe
          className={css.frame}
          src={url}
          title={title}
          loading="lazy"
          onLoad={() => setStatus("ok")}
          allow="fullscreen"
        />
      </div>
      <a className={css.frameFooter} href={url} target="_blank" rel="noopener noreferrer">
        <ArrowSquareOut size={16} aria-hidden />
        <span className={css.frameFooterText}>{title}</span>
      </a>
    </div>
  );
}

export default function ExternalCell({
  cell,
  editing,
}: {
  cell: CellOf<"external">;
  editing: boolean;
}) {
  const { updateCell } = useStore();
  const { t } = useI18n();
  const online = useOnline();
  const [draft, setDraft] = useState("");

  const url = cell.url;
  const provider = url ? detectProvider(url) : null;
  const spec = provider?.embed() ?? null;
  const ProviderIcon = provider ? PROVIDER_ICON[provider.id] : Globe;

  // Timestamp Anchors: a Note anchor can jump this video to a moment. We reload the embed at the
  // requested start time (autoplaying there) — keyed by a bump counter so even the same second
  // re-fires. Only YouTube/Vimeo expose a deterministic start; other providers ignore the request.
  const seekable = !!provider && isSeekableProvider(provider.id) && !!spec;
  const [seek, setSeek] = useState<{ at: number; bump: number } | null>(null);
  const providerId = provider?.id;
  useEffect(() => {
    if (!seekable || !providerId) return;
    return onSeek(cell.id, (seconds) =>
      setSeek((cur) => ({ at: seconds, bump: (cur?.bump ?? 0) + 1 })),
    );
  }, [seekable, providerId, cell.id]);

  function commitUrl(next: string) {
    const u = next.trim();
    if (!u) return;
    const wasAuto = !cell.title; // only auto-fill the title if the maker hasn't set one
    updateCell(cell.id, { url: u, title: cell.title || deriveTitle(u) });
    setDraft("");
    // Online-only nicety: pull a readable title from the provider's oEmbed. Fail-soft.
    if (wasAuto)
      fetchMeta(u).then((meta) => {
        if (meta?.title) updateCell(cell.id, { title: meta.title });
      });
  }

  // ---- empty state -----------------------------------------------------------
  if (!url) {
    if (!editing) return <EmptyState kind="external" title={t("external.noLink")} compact />;
    return (
      <div className={css.col}>
        <div className={shared.mediaEmpty}>
          <ArrowSquareOut size={40} aria-hidden />
          <span className={shared.mediaEmptyTitle}>{t("external.addTitle")}</span>
          <form
            className={css.addForm}
            onSubmit={(e) => {
              e.preventDefault();
              commitUrl(draft);
            }}
          >
            <input
              className={css.urlInput}
              type="url"
              inputMode="url"
              autoComplete="off"
              placeholder={t("external.urlPlaceholder")}
              aria-label={t("external.url")}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
            />
            <Button type="submit" className={shared.btnMagenta} isDisabled={!draft.trim()}>
              {t("common.embed")}
            </Button>
          </form>
        </div>
      </div>
    );
  }

  // ---- the rendered link -----------------------------------------------------
  const chip = provider ? (
    <div className={css.chip}>
      <ProviderIcon size={16} aria-hidden />
      <span className={css.chipLabel}>{provider.label}</span>
      {cell.title && <span className={css.chipTitle}>{cell.title}</span>}
    </div>
  ) : null;

  let body;
  if (!online) {
    // Offline — can't reach the source. Always the placeholder art, a message, and the raw link.
    body = (
      <div className={css.offline}>
        <img className={css.offlineArt} src={offlineArt} alt="" aria-hidden />
        <div className={css.offlineMsg}>{t("external.offline")}</div>
        <a className={css.rawLink} href={url} target="_blank" rel="noopener noreferrer">
          {url}
        </a>
      </div>
    );
  } else if (spec) {
    // A recognised provider with a deterministic embed — show its player, badged with the provider.
    const frameStyle = spec.height
      ? { height: `${spec.height}px` }
      : { aspectRatio: spec.aspect ?? "16 / 9" };
    body = (
      <div className={css.embedWrap}>
        {chip}
        <div
          className={`${css.frameWrap} ${spec.height ? css.audioFrame : css.videoFrame}`}
          style={frameStyle}
        >
          <iframe
            key={seek?.bump ?? 0}
            className={css.frame}
            src={
              (seek && providerId && seekableSrc(providerId, spec.src, seek.at)) || spec.src
            }
            title={cell.title || url}
            loading="lazy"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; fullscreen; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      </div>
    );
  } else {
    // A generic page, or a provider we can't embed deterministically — attempt an iframe first,
    // falling back to a tappable link card if it doesn't load.
    const linkCard = (
      <a className={css.linkCard} href={url} target="_blank" rel="noopener noreferrer">
        <ProviderIcon size={26} aria-hidden className={css.linkIcon} />
        <span className={css.linkText}>
          <span className={css.linkTitle}>{cell.title || url}</span>
          <span className={css.linkUrl}>{provider ? provider.label : url}</span>
        </span>
        <ArrowSquareOut size={18} aria-hidden />
      </a>
    );
    body = <AttemptFrame url={url} title={cell.title || url} chip={chip} fallback={linkCard} />;
  }

  if (!editing) return <div className={css.col}>{body}</div>;

  return (
    <div className={css.col}>
      <div className={css.editBar}>
        <input
          className={css.titleInput}
          value={cell.title}
          placeholder={t("external.titlePlaceholder")}
          aria-label={t("external.title")}
          onChange={(e) => updateCell(cell.id, { title: e.target.value })}
        />
        <Button className={shared.btnSecondary} onPress={() => updateCell(cell.id, { url: "" })}>
          {t("external.changeLink")}
        </Button>
      </div>
      {body}
    </div>
  );
}
