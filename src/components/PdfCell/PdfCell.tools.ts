import type { Dispatch, SetStateAction } from "react";
import {
  SquareIcon as Square,
  ColumnsIcon as Columns,
  ArrowCounterClockwiseIcon as ArrowCounterClockwise,
  ArrowClockwiseIcon as ArrowClockwise,
  ArrowsDownUpIcon as ArrowsDownUp,
  ArrowUpIcon as ArrowUp,
  ArrowDownIcon as ArrowDown,
  CopySimpleIcon as CopySimple,
  FilePlusIcon as FilePlus,
  TrashIcon as Trash,
  UploadSimpleIcon as UploadSimple,
  PencilSimpleLineIcon as PencilSimpleLine,
  RowsIcon as Rows,
} from "@phosphor-icons/react";
import type { Tool } from "../Toolbar/Toolbar.tsx";

// Assembles the PdfCell editor toolbar from its constituent groups. Pure function of its args:
// `scrollTools` and `annotationTools` are the already-built outputs of buildScrollTools and
// buildAnnotationTools (the cell gates `annotationTools` on `annMode`), passed in so this builder
// never depends on the auto-scroll or annotation hooks.
export function buildPdfTools({
  t,
  hasDoc,
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
  openAppend,
  openReplace,
  scrollTools,
  annotationTools,
}: {
  t: (key: string, vars?: Record<string, unknown>) => string;
  hasDoc: boolean;
  flow: "paged" | "all";
  setFlow: Dispatch<SetStateAction<"paged" | "all">>;
  view: "single" | "double";
  setView: Dispatch<SetStateAction<"single" | "double">>;
  page: number;
  numPages: number;
  setPage: Dispatch<SetStateAction<number>>;
  annMode: boolean;
  setAnnMode: Dispatch<SetStateAction<boolean>>;
  rotatePage: (dir: number) => void;
  movePage: (delta: number) => void;
  duplicatePage: () => void;
  removeCurrentPage: () => void;
  openAppend: () => void;
  openReplace: () => void;
  scrollTools: Tool[];
  annotationTools: Tool[];
}): Tool[] {
  // Page editing rewrites the bytes, so it's only available for embedded (dataUrl) PDFs.
  const pageTools: Tool[] = hasDoc
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
          onUse: openAppend,
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
  const annTools: Tool[] = [
    { kind: "sep" },
    {
      kind: "toggle",
      id: "annotate",
      icon: PencilSimpleLine,
      label: t("annotate.pen"),
      value: annMode,
      onToggle: () => setAnnMode((v) => !v),
    },
    ...annotationTools,
  ];
  // Page navigation / spread only apply to the paged flow.
  const navTools: Tool[] =
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
  return [
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
    ...scrollTools,
    ...annTools,
    ...pageTools,
    { kind: "sep" },
    {
      kind: "action",
      id: "replace",
      icon: UploadSimple,
      label: t("pdf.replace"),
      onUse: openReplace,
    },
  ];
}
