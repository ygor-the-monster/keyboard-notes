import { useEffect, useRef, useState } from "react";
import { TextField, Text, Button, DropZone, FileTrigger, Divider } from "@react-spectrum/s2";
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
} from "@phosphor-icons/react";
import { useStore } from "../../providers/StoreProvider/StoreProvider.jsx";
import { useDialog } from "../../providers/DialogProvider/DialogProvider.jsx";
import { pdfjsLib, dataUrlToBytes, bytesToDataUrl, fileToDataUrl } from "./PdfCell.utils.js";
import Toolbar from "../Toolbar/Toolbar.jsx";
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
  const src = cell.dataUrl || cell.url;

  const wrapRef = useRef(null);
  const canvasA = useRef(null);
  const canvasB = useRef(null);
  const docRef = useRef(null);
  const fileRef = useRef(null);
  const appendRef = useRef(null);
  const [numPages, setNumPages] = useState(0);
  const [page, setPage] = useState(1);
  const [view, setView] = useState("single"); // 'single' | 'double'
  const [renderErr, setRenderErr] = useState("");

  // Load the document whenever the source changes.
  useEffect(() => {
    if (!src) return;
    let cancelled = false;
    setRenderErr("");
    const params = cell.dataUrl ? { data: dataUrlToBytes(cell.dataUrl) } : { url: cell.url };
    const task = pdfjsLib.getDocument(params);
    task.promise.then(
      (doc) => {
        if (cancelled) return;
        docRef.current = doc;
        setNumPages(doc.numPages);
        setPage((p) => Math.min(p, doc.numPages));
      },
      (e) => !cancelled && setRenderErr("Couldn't open PDF: " + e.message),
    );
    return () => {
      cancelled = true;
      task.destroy?.();
    };
  }, [src, cell.dataUrl, cell.url]);

  // (Re)render the visible page(s) to fit the cell width.
  useEffect(() => {
    const doc = docRef.current;
    if (!doc || !wrapRef.current) return;
    const wrapW = wrapRef.current.clientWidth || 600;
    const showTwo = view === "double" && page < numPages;
    const gap = 12;
    const cssW = showTwo ? Math.floor((wrapW - gap) / 2) : wrapW;
    let cancelled = false;
    (async () => {
      try {
        if (canvasA.current) await renderPage(doc, page, canvasA.current, cssW);
        if (showTwo && canvasB.current) await renderPage(doc, page + 1, canvasB.current, cssW);
      } catch (e) {
        if (!cancelled) setRenderErr("Render failed: " + e.message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [numPages, page, view, editing, src]);

  async function addFile(file) {
    if (!file || file.type !== "application/pdf") return;
    const dataUrl = await fileToDataUrl(file);
    const sizeMB = (dataUrl.length * 0.75) / 1e6;
    if (sizeMB > 8) {
      const ok = await confirm({
        title: "Large PDF",
        message: `This PDF is ~${sizeMB.toFixed(1)} MB and may exceed local storage. Embed anyway?`,
        confirmLabel: "Embed",
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
      title: `Remove page ${page}?`,
      message: `Page ${page} of ${numPages} will be removed from the PDF.`,
      confirmLabel: "Remove",
      variant: "destructive",
    });
    if (!ok) return;
    const { pdf } = await loadPdf();
    pdf.removePage(page - 1);
    await commitPdf(pdf, Math.min(page, numPages - 1));
  }

  const pageLayer = (canvasRef) => (
    <div className={css.pdfPage}>
      <canvas ref={canvasRef} className={css.pdfCanvas} />
    </div>
  );

  const viewer = src && (
    <div ref={wrapRef} className={css.pdfViewer}>
      <div className={css.pdfPages}>
        {pageLayer(canvasA)}
        {view === "double" && page < numPages && pageLayer(canvasB)}
      </div>
      {renderErr && <div className="abc-error">{renderErr}</div>}
    </div>
  );

  if (!editing) {
    return src ? <div className={css.col}>{viewer}</div> : <Text>No PDF — click to add one.</Text>;
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
            label: "Rotate page",
            options: [
              {
                id: "rl",
                icon: ArrowCounterClockwise,
                label: "Rotate left",
                onUse: () => rotatePage(-1),
              },
              { id: "rr", icon: ArrowClockwise, label: "Rotate right", onUse: () => rotatePage(1) },
            ],
          },
          {
            kind: "group",
            id: "move",
            icon: ArrowsDownUp,
            label: "Move page",
            options: [
              { id: "up", icon: ArrowUp, label: "Move earlier", onUse: () => movePage(-1) },
              { id: "down", icon: ArrowDown, label: "Move later", onUse: () => movePage(1) },
            ],
          },
          {
            kind: "action",
            id: "dup",
            icon: CopySimple,
            label: "Duplicate page",
            onUse: duplicatePage,
          },
          {
            kind: "action",
            id: "append",
            icon: FilePlus,
            label: "Append a PDF",
            onUse: () => appendRef.current?.click(),
          },
          {
            kind: "action",
            id: "del",
            icon: Trash,
            label: "Delete page",
            onUse: removeCurrentPage,
            disabled: numPages <= 1,
          },
        ]
      : [];
    const tools = [
      {
        kind: "spinner",
        id: "page",
        label: "Page",
        display: `${page} / ${numPages || "…"}`,
        onPrev: () => setPage((p) => Math.max(1, p - 1)),
        onNext: () => setPage((p) => Math.min(numPages, p + 1)),
        prevDisabled: page <= 1,
        nextDisabled: page >= numPages,
      },
      { kind: "sep" },
      {
        kind: "toggle",
        id: "view",
        icon: Square,
        altIcon: Columns,
        label: "View: one page",
        altLabel: "View: two pages",
        value: view === "double",
        onToggle: () => setView((v) => (v === "single" ? "double" : "single")),
      },
      ...pageTools,
      { kind: "sep" },
      {
        kind: "action",
        id: "replace",
        icon: UploadSimple,
        label: "Replace PDF",
        onUse: () => fileRef.current?.click(),
      },
    ];
    return (
      <div className={css.col}>
        <Toolbar label="PDF" tools={tools} />
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
          <span className={shared.mediaEmptyTitle}>{cell.name ? cell.name : "Embed a PDF"}</span>
          <FileTrigger
            acceptedFileTypes={["application/pdf"]}
            onSelect={(files) => files && addFile(files[0])}
          >
            <Button variant="primary">Browse…</Button>
          </FileTrigger>
        </div>
      </DropZone>
      <Divider />
      <TextField
        label="…or embed by URL (best for large files)"
        value={cell.url || ""}
        onChange={(url) => updateCell(cell.id, { url, dataUrl: "", name: "" })}
        placeholder="https://example.com/score.pdf"
        styles={dropFull}
      />
    </div>
  );
}
