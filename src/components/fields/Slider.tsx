import {
  Slider as RACSlider,
  Label,
  SliderOutput,
  SliderTrack,
  SliderThumb,
} from "react-aria-components";
import f from "./fields.module.css";

// Styled single-value React Aria Slider. Full-width by default.
export function Slider({
  label,
  value,
  onChange,
  minValue,
  maxValue,
  step,
  format,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  minValue: number;
  maxValue: number;
  step?: number;
  format?: (value: number) => string;
}) {
  return (
    <RACSlider
      className={f.field}
      value={value}
      onChange={(v) => onChange(Array.isArray(v) ? v[0] : v)}
      minValue={minValue}
      maxValue={maxValue}
      step={step}
    >
      <div className={f.sliderTop}>
        <Label className={f.label}>{label}</Label>
        <SliderOutput className={f.output}>
          {({ state }) => (format ? format(state.values[0]) : String(state.values[0]))}
        </SliderOutput>
      </div>
      <SliderTrack className={f.track}>
        {({ state }) => (
          <>
            <div className={f.fill} style={{ width: `${state.getThumbPercent(0) * 100}%` }} />
            <SliderThumb className={f.thumb} />
          </>
        )}
      </SliderTrack>
    </RACSlider>
  );
}
