import { useState } from "react";
import { Button } from "react-aria-components";
import { parseTimecode, fmtTimecode } from "../../utils/seekBus/seekBus.ts";
import f from "../fields/fields.module.css";
import s from "./TimestampAnchorPicker.module.css";

// One seek-able media Cell in the lesson the Note can point at, by its stable code.
export interface SeekTarget {
  code: string;
  label: string;
}

// The popover body for the Note toolbar's "timestamp link" tool: pick a media Cell, type a time
// (m:ss), optionally a label, and insert a `[[code:time|label?]]` token at the cursor. The time is
// validated live; insert is disabled until it parses.
export default function TimestampAnchorPicker({
  targets,
  t,
  onInsert,
  close,
}: {
  targets: SeekTarget[];
  t: (key: string, vars?: Record<string, unknown>) => string;
  onInsert: (code: string, seconds: number, label: string) => void;
  close: () => void;
}) {
  const [code, setCode] = useState(targets[0]?.code ?? "");
  const [time, setTime] = useState("");
  const [label, setLabel] = useState("");
  const seconds = parseTimecode(time);
  const valid = !!code && seconds != null;

  const submit = () => {
    if (!valid || seconds == null) return;
    onInsert(code, seconds, label.trim());
    close();
  };

  return (
    <div className={s.picker}>
      <label className={s.row}>
        <span className={s.label}>{t("note.timestampTarget")}</span>
        <select className={f.textInput} value={code} onChange={(e) => setCode(e.target.value)}>
          {targets.map((tg) => (
            <option key={tg.code} value={tg.code}>
              {tg.label} · {tg.code}
            </option>
          ))}
        </select>
      </label>

      <label className={s.row}>
        <span className={s.label}>{t("note.timestampTime")}</span>
        <input
          className={f.textInput}
          value={time}
          inputMode="numeric"
          placeholder="1:23"
          autoFocus
          onChange={(e) => setTime(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submit();
            }
          }}
        />
      </label>

      <label className={s.row}>
        <span className={s.label}>{t("note.timestampLabel")}</span>
        <input
          className={f.textInput}
          value={label}
          placeholder={seconds != null ? fmtTimecode(seconds) : ""}
          onChange={(e) => setLabel(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submit();
            }
          }}
        />
      </label>

      <Button className={s.insert} isDisabled={!valid} onPress={submit}>
        {t("note.timestampInsert")}
      </Button>
    </div>
  );
}
