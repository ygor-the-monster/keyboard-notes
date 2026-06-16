import { ActionButton, ToggleButton, TooltipTrigger, Tooltip } from "@react-spectrum/s2";

// S2 ActionButton (or ToggleButton) holding a Phosphor icon, with a hover/focus tooltip.
// Icon-only + larger default size for tablet-friendly touch targets.
export default function IconBtn({
  icon: Icon,
  label,
  onPress,
  isDisabled,
  isQuiet = true,
  isSelected,
  onChange,
  size = 22,
  buttonSize = "L",
  delay = 450,
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
          <Icon size={size} aria-hidden />
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
          <Icon size={size} aria-hidden />
        </ActionButton>
      )}
      <Tooltip>{label}</Tooltip>
    </TooltipTrigger>
  );
}
