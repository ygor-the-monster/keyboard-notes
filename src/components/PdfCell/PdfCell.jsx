import { useEffect, useRef, useState } from "react";
import { TextField, Button, DropZone, FileTrigger, Divider } from "@react-spectrum/s2";
import EmptyState from "../EmptyState/EmptyState.tsx";
import {
  FilePdf,
  Square,
  Columns,
  ArrowCounterClockwise,
  ArrowClockwise,
  ArrowsDownUp,
  ArrowUp,
  ArrowDown,
  CopySimple,
  FilePlus,
  Trash,
  UploadSimple,
  PencilSimpleLine,
  Rows,
} from "@phosphor-icons/react";
import { useStore } from "../../providers/StoreProvider/StoreProvider.tsx";
import { useDialog } from "../../providers/DialogProvider/DialogProvider.tsx";
import { useI18n } from "../../providers/I18nProvider/I18nProvider.tsx";
import { getPdfjs, dataUrlToBytes, bytesToDataUrl, fileToDataUrl } from "./PdfCell.utils.js";
import { ANNOT_COLORS, buildAnnotationTools } from "../AnnotationLayer/AnnotationLayer.utils.ts";
import { useStrokeHistory } from "../AnnotationLayer/AnnotationLayer.hooks.ts";
import { useAutoScroll, buildScrollTools } from "../../hooks/useAutoScroll.ts";
import AnnotationLayer from "../AnnotationLayer/AnnotationLayer.tsx";
import Toolbar from "../Toolbar/Toolbar.tsx";
import shared from "../../providers/ThemeProvider/ThemeProvider.module.css";
import { dropFull } from "./PdfCell.styled.jsx";
import css from "./PdfCell.module.css";

// Render one pdf.js page into a canvas, fit to `cssWidth`.
async function renderPage(doc, n, canvas, cssWidth) {
  const page = await doc.getPage(n);
  const base = page.getViewport({ scale: 1 });
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const scale = (cssWidth / base.width) * dpr;
  const viewport = page.getViewport({ scale });
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  canvas.style.width = cssWidth + "px";
  canvas.style.height = Math.floor(viewport.height / dpr) + "px";
  await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
}

export default function PdfCell({ cell, editing }) {
  const { updateCell } = useStore();
  const { confirm } = useDialog();
  const { t } = useI18n();
  const src = cell.dataUrl || cell.url;

  const wrapRef = useRef(null);
  const rootRef = useRef(null);
  const canvasRefs = useRef({}); // page number → <canvas>
  const docRef = useRef(null);
  const fileRef = useRef(null);
  const appendRef = useRef(null);
  const [numPages, setNumPages] = useState(0);
  const [page, setPage] = useState(1);
  const [view, setView] = useState("single"); // 'single' | 'double'
  const [flow, setFlow] = useState("paged"); // 'paged' (current page/spread) | 'all' (continuous)
  const [renderErr, setRenderErr] = useState("");

  // Non-destructive annotation overlay (per page). `annotations` maps page number → strokes.
  const annotations = cell.annotations || {};
  const [annMode, setAnnMode] = useState(false);
  const [color, setColor] = useState(ANNOT_COLORS[0].c);
  const [thick, setThick] = useState("m");
  const [opacity, setOpacity] = useState(1);
  const [eraser, setEraser] = useState(false);
  const setPageStrokes = (pageNum, next) =>
    updateCell(cell.id, { annotations: { ...annotations, [pageNum]: next } });
  // Undo/redo history for the current page's annotation (resets when the page changes).
  const annHistory = useStrokeHistory(
    annotations[page] || [],
    (next) => setPageStrokes(page, next),
    page,
  );
  const { scrolling, speed, toggle, setSpeed } = useAutoScroll(rootRef);

  // Load the document whenever the source changes (pdf.js is loaded lazily on first use).
  useEffect(() => {
    if (!src) return;
    let cancelled = false;
    let task;
    setRenderErr("");
    (async () => {
      const pdfjsLib = await getPdfjs();
      if (cancelled) return;
      const params = cell.dataUrl ? { data: dataUrlToBytes(cell.dataUrl) } : { url: cell.url };
      task = pdfjsLib.getDocument(params);
      task.promise.then(
        (doc) => {
          if (cancelled) return;
          docRef.current = doc;
          setNumPages(doc.numPages);
          setPage((p) => Math.min(p, doc.numPages));
        },
        (e) => !cancelled && setRenderErr(t("pdf.openFailed", { msg: e.message })),
      );
    })();
    return () => {
      cancelled = true;
      task?.destroy?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, cell.dataUrl, cell.url]);

  // (Re)render the visible page(s) to fit the cell width. In 'all' (continuous) flow every
  // page is rendered stacked; in 'paged' flow only the current page (and its spread).
  useEffect(() => {
    const doc = docRef.current;
    if (!doc || !wrapRef.current) return;
    const wrapW = wrapRef.current.clientWidth || 600;
    let cancelled = false;
    (async () => {
      try {
        const refs = canvasRefs.current;
        if (flow === "all") {
          for (let n = 1; n <= numPages && !cancelled; n++) {
            if (refs[n]) await renderPage(doc, n, refs[n], wrapW);
          }
        } else {
          const showTwo = view === "double" && page < numPages;
          const cssW = showTwo ? Math.floor((wrapW - 12) / 2) : wrapW;
          if (refs[page]) await renderPage(doc, page, refs[page], cssW);
          if (showTwo && refs[page + 1]) await renderPage(doc, page + 1, refs[page + 1], cssW);
        }
      } catch (e) {
        if (!cancelled) setRenderErr(t("pdf.renderFailed", { msg: e.message }));
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [numPages, page, view, flow, editing, src]);

  async function addFile(file) {
    if (!file || file.type !== "application/pdf") return;
    const dataUrl = await fileToDataUrl(file);
    const sizeMB = (dataUrl.length * 0.75) / 1e6;
    if (sizeMB > 8) {
      const ok = await confirm({
        title: t("pdf.largeTitle"),
        message: t("pdf.largeMsg", { mb: sizeMB.toFixed(1) }),
        confirmLabel: t("common.embed"),
      });
      if (!ok) return;
    }
    setPage(1);
    updateCell(cell.id, { dataUrl, name: file.name, url: "" });
  }

  // --- Page manipulation (pdf-lib) — operates on the currently shown page ------
  async function loadPdf() {
    const { PDFDocument, degrees } = await import("pdf-lib");
    const pdf = await PDFDocument.load(dataUrlToBytes(cell.dataUrl));
    return { PDFDocument, degrees, pdf };
  }
  async function commitPdf(pdf, nextPage) {
    const bytes = await pdf.save();
    if (nextPage != null) setPage(nextPage);
    updateCell(cell.id, { dataUrl: bytesToDataUrl(bytes) });
  }
  async function rotatePage(dir) {
    if (!cell.dataUrl) return;
    const { pdf, degrees } = await loadPdf();
    const p = pdf.getPage(page - 1);
    p.setRotation(degrees((p.getRotation().angle + dir * 90 + 360) % 360));
    await commitPdf(pdf);
  }
  async function movePage(delta) {
    if (!cell.dataUrl) return;
    const to = page - 1 + delta;
    if (to < 0 || to >= numPages) return;
    const { PDFDocument, pdf } = await loadPdf();
    const order = [...Array(pdf.getPageCount()).keys()];
    order.splice(to, 0, order.splice(page - 1, 1)[0]);
    const out = await PDFDocument.create();
    (await out.copyPages(pdf, order)).forEach((p) => out.addPage(p));
    await commitPdf(out, to + 1);
  }
  async function duplicatePage() {
    if (!cell.dataUrl) return;
    const { pdf } = await loadPdf();
    const [copy] = await pdf.copyPages(pdf, [page - 1]);
    pdf.insertPage(page, copy);
    await commitPdf(pdf, page + 1);
  }
  async function appendPdf(file) {
    if (!file || file.type !== "application/pdf" || !cell.dataUrl) return;
    const { PDFDocument } = await import("pdf-lib");
    const pdf = await PDFDocument.load(dataUrlToBytes(cell.dataUrl));
    const incoming = await PDFDocument.load(await file.arrayBuffer());
    const copied = await pdf.copyPages(incoming, incoming.getPageIndices());
    copied.forEach((p) => pdf.addPage(p));
    await commitPdf(pdf);
  }
  async function removeCurrentPage() {
    if (!cell.dataUrl || numPages <= 1) return;
    const ok = await confirm({
      title: t("pdf.deletePageTitle", { page }),
      message: t("pdf.deletePageMsg", { page, total: numPages }),
      confirmLabel: t("common.remove"),
      variant: "destructive",
    });
    if (!ok) return;
    const { pdf } = await loadPdf();
    pdf.removePage(page - 1);
    await commitPdf(pdf, Math.min(page, numPages - 1));
  }

  const pageLayer = (pageNum) => (
    <div className={css.pdfPage} key={pageNum}>
      <canvas
        ref={(el) => {
          if (el) canvasRefs.current[pageNum] = el;
          else delete canvasRefs.current[pageNum];
        }}
        className={css.pdfCanvas}
      />
      <AnnotationLayer
        strokes={annotations[pageNum] || []}
        onChange={(next) =>
          pageNum === page ? annHistory.commit(next) : setPageStrokes(pageNum, next)
        }
        active={editing && annMode}
        color={color}
        thick={thick}
        opacity={opacity}
        eraser={eraser}
      />
    </div>
  );

  // Which pages are on screen: every page in continuous flow, else the current page/spread.
  const visiblePages =
    flow === "all"
      ? Array.from({ length: numPages }, (_, i) => i + 1)
      : view === "double" && page < numPages
        ? [page, page + 1]
        : [page];

  const viewer = src && (
    <div ref={wrapRef} className={css.pdfViewer}>
      <div className={flow === "all" ? css.pdfPagesAll : css.pdfPages}>
        {visiblePages.map((n) => pageLayer(n))}
      </div>
      {renderErr && <div className="abc-error">{renderErr}</div>}
    </div>
  );

  if (!editing) {
    return src ? (
      <div ref={rootRef} className={css.col}>
        {viewer}
      </div>
    ) : (
      <EmptyState kind="pdf" title={t("pdf.noPdf")} compact />
    );
  }

  // Editing with a loaded PDF: page navigation + page manipulation.
  if (src) {
    // Page editing rewrites the bytes, so it's only available for embedded (dataUrl) PDFs.
    const pageTools = cell.dataUrl
      ? [
          { kind: "sep" },
          {
            kind: "group",
            id: "rotate",
            icon: ArrowClockwise,
            label: t("pdf.rotatePage"),
            options: [
              {
                id: "rl",
                icon: ArrowCounterClockwise,
                label: t("image.rotateLeft"),
                onUse: () => rotatePage(-1),
              },
              {
                id: "rr",
                icon: ArrowClockwise,
                label: t("image.rotateRight"),
                onUse: () => rotatePage(1),
              },
            ],
          },
          {
            kind: "group",
            id: "move",
            icon: ArrowsDownUp,
            label: t("pdf.movePage"),
            options: [
              { id: "up", icon: ArrowUp, label: t("pdf.moveEarlier"), onUse: () => movePage(-1) },
              { id: "down", icon: ArrowDown, label: t("pdf.moveLater"), onUse: () => movePage(1) },
            ],
          },
          {
            kind: "action",
            id: "dup",
            icon: CopySimple,
            label: t("pdf.duplicatePage"),
            onUse: duplicatePage,
          },
          {
            kind: "action",
            id: "append",
            icon: FilePlus,
            label: t("pdf.appendPdf"),
            onUse: () => appendRef.current?.click(),
          },
          {
            kind: "action",
            id: "del",
            icon: Trash,
            label: t("pdf.deletePage"),
            onUse: removeCurrentPage,
            disabled: numPages <= 1,
          },
        ]
      : [];
    const annTools = [
      { kind: "sep" },
      {
        kind: "toggle",
        id: "annotate",
        icon: PencilSimpleLine,
        label: t("annotate.pen"),
        value: annMode,
        onToggle: () => setAnnMode((v) => !v),
      },
      ...(annMode
        ? buildAnnotationTools({
            t,
            color,
            setColor,
            thick,
            setThick,
            opacity,
            setOpacity,
            eraser,
            setEraser,
            onUndo: annHistory.undo,
            onRedo: annHistory.redo,
            onClear: annHistory.clear,
            canUndo: annHistory.canUndo,
            canRedo: annHistory.canRedo,
            canClear: annHistory.canClear,
          })
        : []),
    ];
    // Page navigation / spread only apply to the paged flow.
    const navTools =
      flow === "paged"
        ? [
            {
              kind: "spinner",
              id: "page",
              label: t("pdf.page"),
              display: `${page} / ${numPages || "…"}`,
              onPrev: () => setPage((p) => Math.max(1, p - 1)),
              onNext: () => setPage((p) => Math.min(numPages, p + 1)),
              prevDisabled: page <= 1,
              nextDisabled: page >= numPages,
            },
            {
              kind: "toggle",
              id: "view",
              icon: Square,
              altIcon: Columns,
              label: t("pdf.viewOne"),
              altLabel: t("pdf.viewTwo"),
              value: view === "double",
              onToggle: () => setView((v) => (v === "single" ? "double" : "single")),
            },
          ]
        : [];
    const tools = [
      {
        kind: "toggle",
        id: "flow",
        icon: Square,
        altIcon: Rows,
        label: t("pdf.viewPaged"),
        altLabel: t("pdf.viewAll"),
        value: flow === "all",
        onToggle: () => setFlow((f) => (f === "paged" ? "all" : "paged")),
      },
      ...navTools,
      { kind: "sep" },
      ...buildScrollTools({ t, scrolling, toggle, speed, setSpeed }),
      ...annTools,
      ...pageTools,
      { kind: "sep" },
      {
        kind: "action",
        id: "replace",
        icon: UploadSimple,
        label: t("pdf.replace"),
        onUse: () => fileRef.current?.click(),
      },
    ];
    return (
      <div ref={rootRef} className={css.col}>
        <Toolbar label={t("cell.pdf")} tools={tools} />
        {viewer}
        <input
          ref={fileRef}
          type="file"
          accept="application/pdf,.pdf"
          hidden
          onChange={(e) => {
            const f = e.target.files[0];
            e.target.value = "";
            if (f) addFile(f);
          }}
        />
        <input
          ref={appendRef}
          type="file"
          accept="application/pdf,.pdf"
          hidden
          onChange={(e) => {
            const f = e.target.files[0];
            e.target.value = "";
            if (f) appendPdf(f);
          }}
        />
      </div>
    );
  }

  // Empty state — embed by file or URL.
  return (
    <div className={css.col}>
      <DropZone
        onDrop={async (e) => {
          const f = e.items.find((i) => i.kind === "file");
          if (f) addFile(await f.getFile());
        }}
        styles={dropFull}
      >
        <div className={shared.mediaEmpty}>
          <FilePdf size={40} aria-hidden />
          <span className={shared.mediaEmptyTitle}>
            {cell.name ? cell.name : t("pdf.embedTitle")}
          </span>
          <FileTrigger
            acceptedFileTypes={["application/pdf"]}
            onSelect={(files) => files && addFile(files[0])}
          >
            <Button variant="primary">{t("common.browse")}</Button>
          </FileTrigger>
        </div>
      </DropZone>
      <Divider />
      <TextField
        label={t("pdf.byUrl")}
        value={cell.url || ""}
        onChange={(url) => updateCell(cell.id, { url, dataUrl: "", name: "" })}
        placeholder={t("pdf.urlPlaceholder")}
        styles={dropFull}
      />
    </div>
  );
}
