import { useEffect, useRef, useState } from "react";
import { TextField, Input, Label, Button, DropZone, FileTrigger, Separator } from "react-aria-components";
import EmptyState from "../EmptyState/EmptyState.tsx";
import { FilePdfIcon as FilePdf } from "@phosphor-icons/react";
import { useStore } from "../../providers/StoreProvider/StoreProvider.tsx";
import { useDialog } from "../../providers/DialogProvider/DialogProvider.tsx";
import { useI18n } from "../../providers/I18nProvider/I18nProvider.tsx";
import {
  getPdfjs,
  dataUrlToBytes,
  bytesToDataUrl,
  fileToDataUrl,
  dataUrlSizeMB,
} from "./PdfCell.utils.ts";
import { ANNOT_COLORS, buildAnnotationTools } from "../AnnotationLayer/AnnotationLayer.utils.ts";
import { useStrokeHistory } from "../AnnotationLayer/AnnotationLayer.hooks.ts";
import { useAutoScroll, buildScrollTools } from "../../hooks/useAutoScroll.ts";
import AnnotationLayer from "../AnnotationLayer/AnnotationLayer.tsx";
import Toolbar from "../Toolbar/Toolbar.tsx";
import type { Tool } from "../Toolbar/Toolbar.tsx";
import { buildPdfTools } from "./PdfCell.tools.ts";
import { displayScale } from "../../utils/canvas/canvas.ts";
import type { AnnotationStroke, CellOf } from "../../utils/cellKinds/cellKinds.ts";
import type { PDFDocumentProxy, PDFDocumentLoadingTask } from "pdfjs-dist";
import type { PDFDocument, PDFPage } from "pdf-lib";
import shared from "../../providers/ThemeProvider/ThemeProvider.module.css";
import f from "../fields/fields.module.css";
import css from "./PdfCell.module.css";

// Render one pdf.js page into a canvas, fit to `cssWidth`. pdf.js objects are typed `any` —
// the library is the seam here, not our logic.
async function renderPage(
  doc: PDFDocumentProxy,
  n: number,
  canvas: HTMLCanvasElement,
  cssWidth: number,
) {
  const page = await doc.getPage(n);
  const base = page.getViewport({ scale: 1 });
  const dpr = displayScale();
  const scale = (cssWidth / base.width) * dpr;
  const viewport = page.getViewport({ scale });
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  canvas.style.width = cssWidth + "px";
  canvas.style.height = Math.floor(viewport.height / dpr) + "px";
  await page.render({ canvas, canvasContext: canvas.getContext("2d")!, viewport }).promise;
}

export default function PdfCell({ cell, editing }: { cell: CellOf<"pdf">; editing: boolean }) {
  const { updateCell } = useStore();
  const { confirm } = useDialog();
  const { t } = useI18n();
  const src = cell.dataUrl || cell.url;

  const wrapRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRefs = useRef<Record<number, HTMLCanvasElement>>({}); // page number → <canvas>
  const docRef = useRef<PDFDocumentProxy | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const appendRef = useRef<HTMLInputElement>(null);
  const [numPages, setNumPages] = useState(0);
  const [page, setPage] = useState(1);
  const [view, setView] = useState<"single" | "double">("single");
  const [flow, setFlow] = useState<"paged" | "all">("paged");
  const [renderErr, setRenderErr] = useState("");

  // Non-destructive annotation overlay (per page). `annotations` maps page number → strokes.
  const annotations = cell.annotations || {};
  const [annMode, setAnnMode] = useState(false);
  const [color, setColor] = useState(ANNOT_COLORS[0].c);
  const [thick, setThick] = useState("m");
  const [opacity, setOpacity] = useState(1);
  const [eraser, setEraser] = useState(false);
  const setPageStrokes = (pageNum: number, next: AnnotationStroke[]) =>
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
    let task: PDFDocumentLoadingTask | undefined;
    setRenderErr("");
    (async () => {
      const pdfjsLib = await getPdfjs();
      if (cancelled) return;
      const params = cell.dataUrl ? { data: dataUrlToBytes(cell.dataUrl) } : { url: cell.url };
      task = pdfjsLib.getDocument(params);
      task.promise.then(
        (doc: PDFDocumentProxy) => {
          if (cancelled) return;
          docRef.current = doc;
          setNumPages(doc.numPages);
          setPage((p) => Math.min(p, doc.numPages));
        },
        (e: unknown) =>
          !cancelled && setRenderErr(t("pdf.openFailed", { msg: (e as Error).message })),
      );
    })();
    return () => {
      cancelled = true;
      task?.destroy?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, cell.dataUrl, cell.url]);

  // (Re)render the visible page(s) to fit the cell width.
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
        if (!cancelled) setRenderErr(t("pdf.renderFailed", { msg: (e as Error).message }));
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [numPages, page, view, flow, editing, src]);

  async function addFile(file: File | null) {
    if (!file || file.type !== "application/pdf") return;
    const dataUrl = await fileToDataUrl(file);
    const sizeMB = dataUrlSizeMB(dataUrl);
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

  // --- Page manipulation (pdf-lib) — operates on the currently shown page. pdf-lib objects are
  // typed `any`: the library is the seam.
  async function loadPdf() {
    const { PDFDocument, degrees } = await import("pdf-lib");
    const pdf = await PDFDocument.load(dataUrlToBytes(cell.dataUrl));
    return { PDFDocument, degrees, pdf };
  }
  async function commitPdf(pdf: PDFDocument, nextPage?: number) {
    const bytes = await pdf.save();
    if (nextPage != null) setPage(nextPage);
    updateCell(cell.id, { dataUrl: bytesToDataUrl(bytes) });
  }
  async function rotatePage(dir: number) {
    if (!cell.dataUrl) return;
    const { pdf, degrees } = await loadPdf();
    const p = pdf.getPage(page - 1);
    p.setRotation(degrees((p.getRotation().angle + dir * 90 + 360) % 360));
    await commitPdf(pdf);
  }
  async function movePage(delta: number) {
    if (!cell.dataUrl) return;
    const to = page - 1 + delta;
    if (to < 0 || to >= numPages) return;
    const { PDFDocument, pdf } = await loadPdf();
    const order = [...Array(pdf.getPageCount()).keys()];
    order.splice(to, 0, order.splice(page - 1, 1)[0]);
    const out = await PDFDocument.create();
    (await out.copyPages(pdf, order)).forEach((p: PDFPage) => out.addPage(p));
    await commitPdf(out, to + 1);
  }
  async function duplicatePage() {
    if (!cell.dataUrl) return;
    const { pdf } = await loadPdf();
    const [copy] = await pdf.copyPages(pdf, [page - 1]);
    pdf.insertPage(page, copy);
    await commitPdf(pdf, page + 1);
  }
  async function appendPdf(file: File | null) {
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

  const pageLayer = (pageNum: number) => (
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
    const tools: Tool[] = buildPdfTools({
      t,
      hasDoc: !!cell.dataUrl,
      flow,
      setFlow,
      view,
      setView,
      page,
      numPages,
      setPage,
      annMode,
      setAnnMode,
      rotatePage,
      movePage,
      duplicatePage,
      removeCurrentPage,
      openAppend: () => appendRef.current?.click(),
      openReplace: () => fileRef.current?.click(),
      scrollTools: buildScrollTools({ t, scrolling, toggle, speed, setSpeed }),
      annotationTools: annMode
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
        : [],
    });
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
            const f = e.target.files?.[0];
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
            const f = e.target.files?.[0];
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
        className={shared.dropZone}
        onDrop={async (e) => {
          const item = e.items.find((i) => i.kind === "file");
          if (item && item.kind === "file") addFile(await item.getFile());
        }}
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
            <Button className={shared.btnMagenta}>{t("common.browse")}</Button>
          </FileTrigger>
        </div>
      </DropZone>
      <Separator className={f.divider} />
      <TextField
        className={f.field}
        value={cell.url || ""}
        onChange={(url) => updateCell(cell.id, { url, dataUrl: "", name: "" })}
      >
        <Label className={f.label}>{t("pdf.byUrl")}</Label>
        <Input className={f.textInput} placeholder={t("pdf.urlPlaceholder")} />
      </TextField>
    </div>
  );
}
