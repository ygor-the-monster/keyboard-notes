import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Button, TextArea, TextField } from "react-aria-components";
import { SparkleIcon as Sparkle, CaretDownIcon as CaretDown } from "@phosphor-icons/react";
import { useStore } from "../../providers/StoreProvider/StoreProvider.tsx";
import { useI18n } from "../../providers/I18nProvider/I18nProvider.tsx";
import { useDialog } from "../../providers/DialogProvider/DialogProvider.tsx";
import { usePref } from "../../providers/StoreProvider/StoreProvider.utils.ts";
import { renderMarkdown } from "../NoteCell/NoteCell.utils.ts";
import { buildKnowledgeBase, runChat, type ChatTurn } from "../../utils/lessonChat/lessonChat.ts";
import { AssistantError } from "../../utils/notationAssistant/notationAssistant.ts";
import { DEFAULT_TIER, MODEL_TIER_PREF, resolveTier, type ModelTier } from "../../utils/aiModel/aiModel.ts";
import ModelTierSelect from "../ModelTierSelect/ModelTierSelect.tsx";
import s from "./LessonChat.module.css";

// The standalone on-device "music tutor" — a special card docked below the cells and the add-cell
// strip (rendered by App, not part of the lesson's cell list, so it stays out of the data model).
// Grounded by a bundled music-theory KB + a digest of the user's own lessons (see lessonChat.ts).
type Status =
  | { kind: "idle" }
  | { kind: "loading"; pct: number | null }
  | { kind: "thinking" }
  | { kind: "error"; msg: string };

// User bubbles cycle these in order so the thread reads as a little rainbow. Only the vivid
// 900-shade hues that stay legible under white text (gold is too light, so it sits out here
// even though it appears in the decorative gradients).
const BUBBLE_HUES = [
  "var(--s-magenta)",
  "var(--s-orange)",
  "var(--s-seafoam)",
  "var(--s-blue)",
  "var(--s-purple)",
  "var(--s-indigo)",
  "var(--s-cinnamon)",
];

export default function LessonChat() {
  const { state } = useStore();
  const { t } = useI18n();
  const { confirm } = useDialog();
  const [consented, setConsented] = usePref("chat.ai.consent", false);
  const [tier] = usePref<ModelTier>(MODEL_TIER_PREF, DEFAULT_TIER);
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const busy = status.kind === "loading" || status.kind === "thinking";
  const logRef = useRef<HTMLDivElement>(null);

  // The CellRail's rainbow star scrolls here and fires this event to expand the card on arrival.
  useEffect(() => {
    const openIt = () => setOpen(true);
    window.addEventListener("lessonchat:open", openIt);
    return () => window.removeEventListener("lessonchat:open", openIt);
  }, []);

  async function send() {
    const text = input.trim();
    if (!text || busy) return;

    if (!consented) {
      const ok = await confirm({
        title: t("chat.enableTitle"),
        message: t("chat.enableMsg", { size: resolveTier(tier).approxSize }),
        confirmLabel: t("chat.enableConfirm"),
      });
      if (!ok) return;
      setConsented(true);
    }

    const history: ChatTurn[] = [...turns, { role: "user", content: text }];
    setTurns(history);
    setInput("");
    setStatus({ kind: "loading", pct: null });
    // Let the new user turn paint, then pin the log to the bottom.
    queueMicrotask(() => logRef.current?.scrollTo({ top: logRef.current.scrollHeight }));
    try {
      const kb = buildKnowledgeBase(state);
      const reply = await runChat(
        history,
        kb,
        (p) => {
          const pct = typeof p.progress === "number" ? Math.round(p.progress) : null;
          setStatus((cur) => (cur.kind === "thinking" ? cur : { kind: "loading", pct }));
        },
        tier,
      );
      setStatus({ kind: "thinking" });
      setTurns([...history, { role: "assistant", content: reply }]);
      setStatus({ kind: "idle" });
      queueMicrotask(() => logRef.current?.scrollTo({ top: logRef.current.scrollHeight }));
    } catch (e) {
      const code = e instanceof AssistantError ? e.code : "failed";
      const msg =
        code === "unsupported"
          ? t("chat.errUnsupported")
          : t("chat.errFailed", { msg: (e as Error).message });
      setStatus({ kind: "error", msg });
    }
  }

  // Not tied to a single cell hue: a quiet purple carries the functional accent (focus ring,
  // input border) while the rainbow --tutor-gradient carries the identity (sparkle, title, send
  // pill, top hairline). User bubbles cycle the Spectrum cell hues so the thread reads as a
  // little rainbow — see BUBBLE_HUES; we track a running user-turn index while mapping.
  const style = {
    "--accent": "var(--s-purple)",
    "--accent-ring": "var(--s-purple-ring)",
    "--seg-active": "var(--tutor-gradient)",
  } as CSSProperties;
  // User bubbles cycle BUBBLE_HUES in order; the send button wears the *next* hue in the cycle, so
  // it previews the color the message you're about to send will be.
  let userIdx = -1;
  const userCount = turns.reduce((n, m) => (m.role === "user" ? n + 1 : n), 0);
  const nextHue = BUBBLE_HUES[userCount % BUBBLE_HUES.length];

  return (
    <section
      className={`${s.card} no-print`}
      style={style}
      aria-label={t("chat.title")}
      data-lesson-chat
    >
      {/* Off-screen gradient def the sparkle fills via `fill: url(#tutor-grad)` (CSS beats the
          icon's currentColor attribute). Stops use the theme vars so dark mode tracks along. */}
      <svg width="0" height="0" aria-hidden focusable="false" className={s.defs}>
        <defs>
          <linearGradient id="tutor-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" style={{ stopColor: "var(--s-magenta)" }} />
            <stop offset="38%" style={{ stopColor: "var(--s-purple)" }} />
            <stop offset="70%" style={{ stopColor: "var(--s-blue)" }} />
            <stop offset="100%" style={{ stopColor: "var(--s-seafoam)" }} />
          </linearGradient>
        </defs>
      </svg>
      <button
        type="button"
        className={s.header}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <Sparkle size={18} weight="fill" aria-hidden className={s.spark} />
        <span className={s.titles}>
          <span className={`${s.title} ${s.titleGrad}`}>{t("chat.title")}</span>
          <span className={s.subtitle}>{t("chat.subtitle")}</span>
        </span>
        <CaretDown size={18} aria-hidden className={open ? `${s.caret} ${s.caretOpen}` : s.caret} />
      </button>

      <div
        className={open ? `${s.bodyWrap} ${s.bodyWrapOpen}` : s.bodyWrap}
        inert={!open}
      >
        <div className={s.body}>
          <ModelTierSelect />
          <div className={s.log} ref={logRef}>
            {turns.length === 0 ? (
              <p className={s.empty}>{t("chat.empty")}</p>
            ) : (
              turns.map((m, i) =>
                m.role === "user" ? (
                  <div
                    key={i}
                    className={s.user}
                    style={{ "--bubble": BUBBLE_HUES[(++userIdx) % BUBBLE_HUES.length] } as CSSProperties}
                  >
                    {m.content}
                  </div>
                ) : (
                  <div
                    key={i}
                    className={`${s.assistant} md-preview`}
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(m.content, `chat-${i}`) }}
                  />
                ),
              )
            )}
            {status.kind === "thinking" && <div className={s.status}>{t("chat.thinking")}</div>}
            {status.kind === "loading" && (
              <div className={s.status}>
                {status.pct != null
                  ? t("chat.downloading", { pct: status.pct })
                  : t("chat.loading")}
              </div>
            )}
            {status.kind === "error" && <div className={s.errorMsg}>{status.msg}</div>}
          </div>

          <div className={s.composer}>
            <TextField
              aria-label={t("chat.title")}
              value={input}
              onChange={setInput}
              isDisabled={busy}
              className={s.field}
            >
              <TextArea
                className={s.input}
                rows={3}
                placeholder={t("chat.placeholder")}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void send();
                  }
                }}
              />
            </TextField>
            <Button
              className={s.send}
              style={{ background: nextHue }}
              onPress={() => void send()}
              isDisabled={busy || !input.trim()}
            >
              {t("chat.send")}
            </Button>
          </div>
          <p className={s.sources}>{t("chat.sources")}</p>
        </div>
      </div>
    </section>
  );
}
