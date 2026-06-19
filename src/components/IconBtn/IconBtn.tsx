import { Button, ToggleButton, TooltipTrigger, Tooltip } from "react-aria-components";
import type { Icon } from "@phosphor-icons/react";
import s from "./IconBtn.module.css";

// A quiet, icon-only button (React Aria) with a hover/focus tooltip. Square, tablet-friendly hit
// area. Becomes a ToggleButton when `isSelected`/`onChange` is given.
export default function IconBtn({
  icon: IconCmp,
  label,
  onPress,
  isDisabled,
  isSelected,
  onChange,
  size = 22,
  buttonSize = "L",
  delay = 450,
}: {
  icon: Icon;
  label: string;
  onPress?: () => void;
  isDisabled?: boolean;
  isSelected?: boolean;
  onChange?: (isSelected: boolean) => void;
  size?: number;
  buttonSize?: "S" | "M" | "L" | "XL";
  delay?: number;
}) {
  const toggle = isSelected !== undefined || onChange !== undefined;
  const cls = `${s.btn} ${s[`size${buttonSize}`]}`;
  return (
    <TooltipTrigger delay={delay}>
      {toggle ? (
        <ToggleButton
          aria-label={label}
          className={cls}
          isSelected={isSelected}
          onChange={onChange}
          isDisabled={isDisabled}
        >
          <IconCmp size={size} aria-hidden />
        </ToggleButton>
      ) : (
        <Button aria-label={label} className={cls} onPress={onPress} isDisabled={isDisabled}>
          <IconCmp size={size} aria-hidden />
        </Button>
      )}
      <Tooltip className={s.tooltip} offset={6}>
        {label}
      </Tooltip>
    </TooltipTrigger>
  );
}
