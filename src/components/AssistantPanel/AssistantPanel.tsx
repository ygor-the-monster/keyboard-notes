import { useRef, useState, type CSSProperties } from "react";
import { Button, TextArea, TextField } from "react-aria-components";
import { SparkleIcon as Sparkle } from "@phosphor-icons/react";
import { useI18n } from "../../providers/I18nProvider/I18nProvider.tsx";
import { useDialog } from "../../providers/DialogProvider/DialogProvider.tsx";
import { usePref } from "../../providers/StoreProvider/StoreProvider.utils.ts";
import {
  AssistantError,
  type LoadProgress,
} from "../../utils/notationAssistant/notationAssistant.ts";
import { DEFAULT_TIER, MODEL_TIER_PREF, resolveTier, type ModelTier } from "../../utils/aiModel/aiModel.ts";
import ModelTierSelect from "../ModelTierSelect/ModelTierSelect.tsx";
import s from "./AssistantPanel.module.css";

// The popped-out panel for the toolbar's "assistant" input-tool, shared by every text-bearing cell
// (Score / Note / Cifra). It owns the generic flow — consent, model download progress, the
// thinking state, errors, and a one-step Undo — and is decoupled from *what* it edits via three
// callbacks: snapshot the current content (for Undo), transform it (run the on-device model), and
// apply a content value. `T` is the cell's content shape ({ header, body } | { source }).
type Status =
  | { kind: "idle" }
  | { kind: "loading"; pct: number | null }
  | { kind: "thinking" }
  | { kind: "error"; msg: string };

export default function AssistantPanel<T>({
  hintKey,
  accent,
  snapshot,
  apply,
  transform,
  close,
}: {
  /** i18n key for the per-cell hint line (e.g. "assistant.hintNote"). */
  hintKey: string;
  /** The owning cell's hue base token (e.g. "--s-magenta") so the popped-out panel — portaled out
   *  of the cell, where it'd otherwise lose the inherited --accent — matches the cell colour. */
  accent?: string;
  /** Current content, captured before a transform so it can be reverted. */
  snapshot: () => T;
  /** Apply a content value to the cell (the transform result, or the snapshot on Undo). */
  apply: (next: T) => void;
  /** Run the on-device model and resolve the new content (throws AssistantError on failure). */
  transform: (
    instruction: string,
    onProgress: (p: LoadProgress) => void,
    tier: ModelTier,
  ) => Promise<T>;
  close: () => void;
}) {
  const { t } = useI18n();
  const { confirm } = useDialog();
  const [consented, setConsented] = usePref("notation.ai.consent", false);
  const [tier] = usePref<ModelTier>(MODEL_TIER_PREF, DEFAULT_TIER);
  const [instruction, setInstruction] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const busy = status.kind === "loading" || status.kind === "thinking";
  // Holds the pre-edit content so a single Undo can revert a transform the user dislikes.
  const undoRef = useRef<T | null>(null);
  const [canUndo, setCanUndo] = useState(false);

  async function run() {
    const text = instruction.trim();
    if (!text || busy) return;

    if (!consented) {
      const ok = await confirm({
        title: t("assistant.enableTitle"),
        message: t("assistant.enableMsg", { size: resolveTier(tier).approxSize }),
        confirmLabel: t("assistant.enableConfirm"),
      });
      if (!ok) return;
      setConsented(true);
    }

    const before = snapshot();
    setStatus({ kind: "loading", pct: null });
    try {
      const next = await transform(
        text,
        (p) => {
          const pct = typeof p.progress === "number" ? Math.round(p.progress) : null;
          setStatus((cur) => (cur.kind === "thinking" ? cur : { kind: "loading", pct }));
        },
        tier,
      );
      setStatus({ kind: "thinking" });
      undoRef.current = before;
      setCanUndo(true);
      apply(next);
      setStatus({ kind: "idle" });
      setInstruction("");
      close();
    } catch (e) {
      const code = e instanceof AssistantError ? e.code : "failed";
      const msg =
        code === "unsupported"
          ? t("assistant.errUnsupported")
          : code === "invalid"
            ? t("assistant.errInvalid")
            : t("assistant.errFailed", { msg: (e as Error).message });
      setStatus({ kind: "error", msg });
    }
  }

  function undo() {
    if (undoRef.current == null) return;
    apply(undoRef.current);
    undoRef.current = null;
    setCanUndo(false);
  }

  // Re-establish the cell accent on the portaled panel (CSS-var inheritance is severed by the
  // portal). The hue's "-ring" variant follows the same naming as the global tokens.
  const accentStyle = accent
    ? ({ "--accent": `var(${accent})`, "--accent-ring": `var(${accent}-ring)` } as CSSProperties)
    : undefined;

  return (
    <div className={s.panel} style={accentStyle}>
      <div className={s.head}>
        <Sparkle size={18} weight="fill" aria-hidden />
        <span className={s.title}>{t("assistant.title")}</span>
      </div>
      <p className={s.hint}>{t(hintKey)}</p>
      <TextField
        aria-label={t("assistant.title")}
        value={instruction}
        onChange={setInstruction}
        isDisabled={busy}
      >
        <TextArea
          // eslint-disable-next-line jsx-a11y/no-autofocus -- focus the field when the panel pops open
          autoFocus
          className={s.input}
          rows={2}
          placeholder={t("assistant.placeholder")}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              void run();
            }
          }}
        />
      </TextField>
      <div className={s.row}>
        <ModelTierSelect variant="compact" />
        <Button
          className={s.run}
          onPress={() => void run()}
          isDisabled={busy || !instruction.trim()}
        >
          {status.kind === "loading"
            ? status.pct != null
              ? t("assistant.downloading", { pct: status.pct })
              : t("assistant.loading")
            : status.kind === "thinking"
              ? t("assistant.thinking")
              : t("assistant.run")}
        </Button>
        {canUndo && (
          <Button className={s.undo} onPress={undo} isDisabled={busy}>
            {t("assistant.revert")}
          </Button>
        )}
      </div>
      {status.kind === "error" && <p className={s.error}>{status.msg}</p>}
    </div>
  );
}
