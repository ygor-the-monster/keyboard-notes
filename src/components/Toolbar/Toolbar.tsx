import { useEffect, useRef, useState, type ReactNode } from "react";
import { ActionButton, ToggleButton, Text, TooltipTrigger, Tooltip } from "@react-spectrum/s2";
import { CaretLeftIcon as CaretLeft, CaretRightIcon as CaretRight } from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";
import shared from "../../providers/ThemeProvider/ThemeProvider.module.css";
import s from "./Toolbar.module.css";

// Unified, declarative cell toolbar. One strip per cell; every tool is one of six kinds, modelled
// as a discriminated union on `kind` so each kind's required fields are enforced at compile time.
// A "face" is the shared visual: a single icon, char, SMuFL glyph, colour swatch, or dot.

interface Face {
  icon?: Icon;
  char?: string;
  glyph?: string;
  dim?: boolean;
  dy?: number;
  swatch?: string;
  dot?: number;
}

export interface ActionTool extends Face {
  kind: "action";
  id: string;
  label: string;
  onUse: () => void;
  disabled?: boolean;
}

export interface ToggleTool extends Face {
  kind: "toggle";
  id: string;
  label: string;
  altLabel?: string;
  altIcon?: Icon;
  altChar?: string;
  value: boolean;
  onToggle: () => void;
}

export interface GroupOption extends Face {
  id: string;
  label: string;
  onUse?: () => void;
  selected?: boolean;
}

export interface GroupTool extends Face {
  kind: "group";
  id: string;
  label: string;
  options: GroupOption[];
}

export interface InputTool extends Face {
  kind: "input";
  id: string;
  label: string;
  render: (ctx: { close: () => void }) => ReactNode;
}

export interface SpinnerTool {
  kind: "spinner";
  id: string;
  label: string;
  display?: ReactNode;
  icon?: Icon;
  onPrev: () => void;
  onNext: () => void;
  prevDisabled?: boolean;
  nextDisabled?: boolean;
}

export interface SepTool {
  kind: "sep";
}

export type Tool = ActionTool | ToggleTool | GroupTool | InputTool | SpinnerTool | SepTool;

function Face({
  icon: IconCmp,
  char,
  glyph,
  dim,
  dy,
  swatch,
  dot,
  size = 20,
}: Face & { size?: number }) {
  if (swatch) return <span className={s.swatch} style={{ background: swatch }} />;
  if (dot) return <span className={s.dot} style={{ width: dot, height: dot }} />;
  if (glyph) {
    const style: { opacity?: number; transform?: string } = {};
    if (dim) style.opacity = 0.4;
    if (dy) style.transform = `translateY(${dy}em)`; // per-glyph vertical centering nudge
    return (
      <span className={s.smufl} style={Object.keys(style).length ? style : undefined}>
        {glyph}
      </span>
    );
  }
  return IconCmp ? <IconCmp size={size} aria-hidden /> : <Text>{char}</Text>;
}

function faceClass(tool: Face): string {
  return tool.icon || tool.glyph || tool.swatch || tool.dot ? shared.btnIcononly : s.charBtn;
}

function OptionButton({ opt, onPick }: { opt: GroupOption; onPick: () => void }) {
  const face = (
    <Face
      icon={opt.icon}
      char={opt.char}
      glyph={opt.glyph}
      dim={opt.dim}
      dy={opt.dy}
      swatch={opt.swatch}
      dot={opt.dot}
    />
  );
  const cls = [faceClass(opt), opt.selected && s.selected].filter(Boolean).join(" ");
  return (
    <TooltipTrigger delay={450}>
      <ActionButton isQuiet size="L" aria-label={opt.label} UNSAFE_className={cls} onPress={onPick}>
        {face}
      </ActionButton>
      <Tooltip>{opt.label}</Tooltip>
    </TooltipTrigger>
  );
}

function ToolView({
  tool,
  open,
  onToggle,
  close,
}: {
  tool: Tool;
  open: boolean;
  onToggle: () => void;
  close: () => void;
}) {
  switch (tool.kind) {
    case "sep":
      return <span className={shared.toolbarSep} aria-hidden />;

    case "action":
      return (
        <TooltipTrigger delay={450}>
          <ActionButton
            isQuiet
            size="L"
            aria-label={tool.label}
            isDisabled={tool.disabled}
            UNSAFE_className={faceClass(tool)}
            onPress={tool.onUse}
          >
            <Face
              icon={tool.icon}
              char={tool.char}
              glyph={tool.glyph}
              swatch={tool.swatch}
              dot={tool.dot}
            />
          </ActionButton>
          <Tooltip>{tool.label}</Tooltip>
        </TooltipTrigger>
      );

    case "toggle": {
      const swap = tool.altIcon || tool.altChar;
      const icon = tool.value && tool.altIcon ? tool.altIcon : tool.icon;
      const char = tool.value && tool.altChar ? tool.altChar : tool.char;
      const label = (tool.value && tool.altLabel) || tool.label;
      return (
        <TooltipTrigger delay={450}>
          <ToggleButton
            isQuiet
            size="L"
            aria-label={label}
            isSelected={swap ? false : !!tool.value}
            onChange={() => tool.onToggle()}
            UNSAFE_className={icon ? shared.btnIcononly : s.charBtn}
          >
            <Face icon={icon} char={char} />
          </ToggleButton>
          <Tooltip>{label}</Tooltip>
        </TooltipTrigger>
      );
    }

    case "group":
      return (
        <span className={s.group}>
          <TooltipTrigger delay={450}>
            <ActionButton
              isQuiet
              size="L"
              aria-label={tool.label}
              aria-expanded={open}
              UNSAFE_className={faceClass(tool)}
              onPress={onToggle}
            >
              <Face
                icon={tool.icon}
                char={tool.char}
                glyph={tool.glyph}
                swatch={tool.swatch}
                dot={tool.dot}
              />
            </ActionButton>
            <Tooltip>{tool.label}</Tooltip>
          </TooltipTrigger>
          {open && (
            <span className={s.expansion}>
              {tool.options.map((opt) => (
                <OptionButton
                  key={opt.id}
                  opt={opt}
                  onPick={() => {
                    opt.onUse?.();
                    close();
                  }}
                />
              ))}
            </span>
          )}
        </span>
      );

    case "input":
      return (
        <span className={s.group}>
          <TooltipTrigger delay={450}>
            <ActionButton
              isQuiet
              size="L"
              aria-label={tool.label}
              aria-expanded={open}
              UNSAFE_className={faceClass(tool)}
              onPress={onToggle}
            >
              <Face
                icon={tool.icon}
                char={tool.char}
                glyph={tool.glyph}
                swatch={tool.swatch}
                dot={tool.dot}
              />
            </ActionButton>
            <Tooltip>{tool.label}</Tooltip>
          </TooltipTrigger>
          {open && <span className={s.expansion}>{tool.render({ close })}</span>}
        </span>
      );

    case "spinner": {
      const SpinIcon = tool.icon;
      // Centre shows a value (e.g. tempo "90 BPM") or, when there's no number, the icon.
      const center =
        tool.display != null ? tool.display : SpinIcon ? <SpinIcon size={18} aria-hidden /> : null;
      return (
        <span className={s.spinner} role="group" aria-label={tool.label}>
          <TooltipTrigger delay={450}>
            <ActionButton
              isQuiet
              size="L"
              aria-label={`${tool.label}: previous`}
              isDisabled={tool.prevDisabled}
              UNSAFE_className={shared.btnIcononly}
              onPress={tool.onPrev}
            >
              <CaretLeft size={18} aria-hidden />
            </ActionButton>
            <Tooltip>{tool.label}</Tooltip>
          </TooltipTrigger>
          <span className={s.spinnerValue}>{center}</span>
          <ActionButton
            isQuiet
            size="L"
            aria-label={`${tool.label}: next`}
            isDisabled={tool.nextDisabled}
            UNSAFE_className={shared.btnIcononly}
            onPress={tool.onNext}
          >
            <CaretRight size={18} aria-hidden />
          </ActionButton>
        </span>
      );
    }

    default:
      return null;
  }
}

export default function Toolbar({ label, tools }: { label: string; tools: Tool[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  // Collapse the open group/input on any click outside the strip.
  useEffect(() => {
    if (openId == null) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpenId(null);
    }
    document.addEventListener("mousedown", onDown, true);
    return () => document.removeEventListener("mousedown", onDown, true);
  }, [openId]);

  return (
    <div ref={ref} className={`${shared.toolStrip} no-print`} role="toolbar" aria-label={label}>
      {tools.filter(Boolean).map((tool, i) => {
        const id = "id" in tool ? tool.id : i;
        return (
          <ToolView
            key={id}
            tool={tool}
            open={"id" in tool && openId === tool.id}
            onToggle={() =>
              "id" in tool ? setOpenId((o) => (o === tool.id ? null : tool.id)) : undefined
            }
            close={() => setOpenId(null)}
          />
        );
      })}
    </div>
  );
}
