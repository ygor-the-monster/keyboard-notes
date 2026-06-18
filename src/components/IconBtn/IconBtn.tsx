import { ActionButton, ToggleButton, TooltipTrigger, Tooltip } from "@react-spectrum/s2";
import type { Icon } from "@phosphor-icons/react";

// S2 ActionButton (or ToggleButton) holding a Phosphor icon, with a hover/focus tooltip.
// Icon-only + larger default size for tablet-friendly touch targets.
export default function IconBtn({
  icon: IconCmp,
  label,
  onPress,
  isDisabled,
  isQuiet = true,
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
  isQuiet?: boolean;
  isSelected?: boolean;
  onChange?: (isSelected: boolean) => void;
  size?: number;
  buttonSize?: "S" | "M" | "L" | "XL";
  delay?: number;
}) {
  const toggle = isSelected !== undefined || onChange !== undefined;
  return (
    <TooltipTrigger delay={delay}>
      {toggle ? (
        <ToggleButton
          aria-label={label}
          isQuiet={isQuiet}
          size={buttonSize}
          isSelected={isSelected}
          onChange={onChange}
          isDisabled={isDisabled}
          UNSAFE_className="btn-icononly"
        >
          <IconCmp size={size} aria-hidden />
        </ToggleButton>
      ) : (
        <ActionButton
          aria-label={label}
          isQuiet={isQuiet}
          size={buttonSize}
          onPress={onPress}
          isDisabled={isDisabled}
          UNSAFE_className="btn-icononly"
        >
          <IconCmp size={size} aria-hidden />
        </ActionButton>
      )}
      <Tooltip>{label}</Tooltip>
    </TooltipTrigger>
  );
}
