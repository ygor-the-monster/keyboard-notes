import type { ReactNode } from "react";
import {
  Select as RACSelect,
  SelectValue,
  Label,
  Button,
  Popover,
  ListBox,
  ListBoxItem,
} from "react-aria-components";
import { CaretDownIcon as CaretDown } from "@phosphor-icons/react";
import f from "./fields.module.css";

// Styled React Aria Select. Full-width by default (fits the utility-dock cards).
export function Select({
  label,
  selectedKey,
  onSelectionChange,
  children,
}: {
  label: string;
  selectedKey: string;
  onSelectionChange: (key: string) => void;
  children: ReactNode;
}) {
  return (
    <RACSelect
      className={f.field}
      selectedKey={selectedKey}
      onSelectionChange={(k) => onSelectionChange(String(k))}
    >
      <Label className={f.label}>{label}</Label>
      <Button className={f.selectBtn}>
        <SelectValue className={f.selectValue} />
        <CaretDown size={14} aria-hidden />
      </Button>
      <Popover className={f.popover}>
        <ListBox className={f.listbox}>{children}</ListBox>
      </Popover>
    </RACSelect>
  );
}

export function SelectItem({ id, children }: { id: string; children: ReactNode }) {
  return (
    <ListBoxItem id={id} textValue={typeof children === "string" ? children : undefined} className={f.option}>
      {children}
    </ListBoxItem>
  );
}
