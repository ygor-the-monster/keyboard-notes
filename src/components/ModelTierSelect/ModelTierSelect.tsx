import { Button } from "react-aria-components";
import { useI18n } from "../../providers/I18nProvider/I18nProvider.tsx";
import { usePref } from "../../providers/StoreProvider/StoreProvider.utils.ts";
import {
  DEFAULT_TIER,
  MODEL_TIER_PREF,
  MODEL_TIERS,
  TIER_ORDER,
  type ModelTier,
} from "../../utils/aiModel/aiModel.ts";
import s from "./ModelTierSelect.module.css";

// Shared on-device model-tier picker. One localStorage pref governs every AI feature (the tutor
// chat and the per-cell editing assistant), so switching here changes which model both load on next
// use. Two layouts: the roomy "segmented" control (the tutor card) and a "compact" dropdown that
// tucks beside the Transform button in the small assistant popups. The active control picks up the
// surrounding --accent, so it matches whatever surface hosts it.
export default function ModelTierSelect({
  variant = "segmented",
}: {
  variant?: "segmented" | "compact";
}) {
  const { t } = useI18n();
  const [tier, setTier] = usePref<ModelTier>(MODEL_TIER_PREF, DEFAULT_TIER);

  if (variant === "compact") {
    return (
      <label className={s.compact}>
        <span className={s.srOnly}>{t("ai.tier.label")}</span>
        <select
          className={s.select}
          value={tier}
          onChange={(e) => setTier(e.target.value as ModelTier)}
        >
          {TIER_ORDER.map((k) => (
            <option key={k} value={k}>
              {t(`ai.tier.${k}`)} · {MODEL_TIERS[k].approxSize}
            </option>
          ))}
        </select>
      </label>
    );
  }

  // The active index drives the sliding thumb: it translates to the selected slot, and its gradient
  // is scaled to the full track (300%) and shifted so the rainbow reads as one continuous band
  // painted across all three segments — the thumb is a moving window onto it.
  const idx = Math.max(0, TIER_ORDER.indexOf(tier));
  const thumbStyle = {
    transform: `translateX(${idx * 100}%)`,
    backgroundPositionX: `${idx * 50}%`,
  };

  return (
    <div className={s.wrap}>
      <div className={s.seg} role="group" aria-label={t("ai.tier.label")}>
        <span className={s.thumb} style={thumbStyle} aria-hidden />
        {TIER_ORDER.map((k) => (
          <Button
            key={k}
            className={k === tier ? `${s.opt} ${s.optOn}` : s.opt}
            aria-pressed={k === tier}
            onPress={() => setTier(k)}
          >
            <span className={s.name}>{t(`ai.tier.${k}`)}</span>
            <span className={s.size}>{MODEL_TIERS[k].approxSize}</span>
          </Button>
        ))}
      </div>
      <p className={s.note}>{t(`ai.tier.${tier}Note`)}</p>
    </div>
  );
}
