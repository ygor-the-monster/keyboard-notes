import { useEffect, useRef, useState, type ReactNode } from "react";
import { Button, ToggleButton, TooltipTrigger, Tooltip } from "react-aria-components";
import { CaretLeftIcon as CaretLeft, CaretRightIcon as CaretRight } from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";
import shared from "../../providers/ThemeProvider/ThemeProvider.module.css";
import ic from "../IconBtn/IconBtn.module.css";
import s from "./Toolbar.module.css";

// Quiet-button base shared with IconBtn (transparent, hover/press tint, focus ring, square hit area).
const baseBtn = `${ic.btn} ${ic.sizeL}`;

// Unified, declarative cell toolbar. One strip per cell; every tool is one of six kinds, modelled
// as a discriminated union on `kind` so each kind's required fields are enforced at compile time.
// A "face" is the shared visual: a single icon, char, SMuFL glyph, colour swatch, or dot.

// A transport tone marks a stateful tool that, when active (playing / recording / auto-scrolling),
// fills with the cell accent as a visual indicator amid the otherwise monochrome strip. "record"
// also pulses so it reads as a live capture.
export type ToolTone = "play" | "record" | "scroll";

interface Face {
  icon?: Icon;
  char?: string;
  glyph?: string;
  dim?: boolean;
  dy?: number;
  swatch?: string;
  dot?: number;
  tone?: ToolTone;
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
  return IconCmp ? <IconCmp size={size} aria-hidden /> : <span>{char}</span>;
}

function faceClass(tool: Face): string {
  return tool.icon || tool.glyph || tool.swatch || tool.dot ? baseBtn : `${baseBtn} ${s.charBtn}`;
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
      <Button aria-label={opt.label} className={cls} onPress={onPick}>
        {face}
      </Button>
      <Tooltip className={ic.tooltip} offset={6}>
        {opt.label}
      </Tooltip>
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
          <Button
            aria-label={tool.label}
            isDisabled={tool.disabled}
            className={faceClass(tool)}
            onPress={tool.onUse}
          >
            <Face
              icon={tool.icon}
              char={tool.char}
              glyph={tool.glyph}
              swatch={tool.swatch}
              dot={tool.dot}
            />
          </Button>
          <Tooltip className={ic.tooltip} offset={6}>
            {tool.label}
          </Tooltip>
        </TooltipTrigger>
      );

    case "toggle": {
      const swap = tool.altIcon || tool.altChar;
      const icon = tool.value && tool.altIcon ? tool.altIcon : tool.icon;
      const char = tool.value && tool.altChar ? tool.altChar : tool.char;
      const label = (tool.value && tool.altLabel) || tool.label;
      const base = icon ? baseBtn : `${baseBtn} ${s.charBtn}`;
      // Tone is a stateful "indicator": idle is normal/quiet, active fills with the accent
      // (record also pulses).
      const tone =
        tool.tone && tool.value ? `${s.toneOn} ${tool.tone === "record" ? s.tonePulse : ""}` : "";
      return (
        <TooltipTrigger delay={450}>
          <ToggleButton
            aria-label={label}
            isSelected={swap ? false : !!tool.value}
            onChange={() => tool.onToggle()}
            className={`${base} ${tone}`}
          >
            <Face icon={icon} char={char} />
          </ToggleButton>
          <Tooltip className={ic.tooltip} offset={6}>
            {label}
          </Tooltip>
        </TooltipTrigger>
      );
    }

    case "group":
      return (
        <span className={s.group}>
          <TooltipTrigger delay={450}>
            <Button
              aria-label={tool.label}
              aria-expanded={open}
              className={faceClass(tool)}
              onPress={onToggle}
            >
              <Face
                icon={tool.icon}
                char={tool.char}
                glyph={tool.glyph}
                swatch={tool.swatch}
                dot={tool.dot}
              />
            </Button>
            <Tooltip className={ic.tooltip} offset={6}>
              {tool.label}
            </Tooltip>
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
            <Button
              aria-label={tool.label}
              aria-expanded={open}
              className={faceClass(tool)}
              onPress={onToggle}
            >
              <Face
                icon={tool.icon}
                char={tool.char}
                glyph={tool.glyph}
                swatch={tool.swatch}
                dot={tool.dot}
              />
            </Button>
            <Tooltip className={ic.tooltip} offset={6}>
              {tool.label}
            </Tooltip>
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
            <Button
              aria-label={`${tool.label}: previous`}
              isDisabled={tool.prevDisabled}
              className={baseBtn}
              onPress={tool.onPrev}
            >
              <CaretLeft size={18} aria-hidden />
            </Button>
            <Tooltip className={ic.tooltip} offset={6}>
              {tool.label}
            </Tooltip>
          </TooltipTrigger>
          <span className={s.spinnerValue}>{center}</span>
          <Button
            aria-label={`${tool.label}: next`}
            isDisabled={tool.nextDisabled}
            className={baseBtn}
            onPress={tool.onNext}
          >
            <CaretRight size={18} aria-hidden />
          </Button>
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
