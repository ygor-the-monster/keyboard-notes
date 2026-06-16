import { useEffect, useRef, useState } from "react";
import { ActionButton, ToggleButton, Text, TooltipTrigger, Tooltip } from "@react-spectrum/s2";
import { CaretLeft, CaretRight } from "@phosphor-icons/react";
import shared from "../../providers/ThemeProvider/ThemeProvider.module.css";
import s from "./Toolbar.module.css";

// Unified, declarative cell toolbar. One strip per cell; tools are one of five kinds:
//   action  — { kind:"action", id, icon?|char?, label, onUse, disabled? }
//   toggle  — { kind:"toggle", id, icon?|char?, altIcon?|altChar?, label, altLabel?, value, onToggle }
//   group   — { kind:"group", id, icon?|char?, label, options:[{id, icon?|char?|swatch?|dot?, label, onUse, selected?}] }
//   input   — { kind:"input", id, icon?|char?, label, render:({close}) => node }
//   spinner — { kind:"spinner", id, label, display, onPrev, onNext, prevDisabled?, nextDisabled? }
//   sep     — { kind:"sep" }
// Every face is a single icon or char. Group/input options slide out inline (pushing siblings).

function Face({ icon: Icon, char, glyph, dim, dy, swatch, dot, size = 20 }) {
  if (swatch) return <span className={s.swatch} style={{ background: swatch }} />;
  if (dot) return <span className={s.dot} style={{ width: dot, height: dot }} />;
  if (glyph) {
    const style = {};
    if (dim) style.opacity = 0.4;
    if (dy) style.transform = `translateY(${dy}em)`; // per-glyph vertical centering nudge
    return (
      <span className={s.smufl} style={Object.keys(style).length ? style : undefined}>
        {glyph}
      </span>
    );
  }
  return Icon ? <Icon size={size} aria-hidden /> : <Text>{char}</Text>;
}

function faceClass(tool) {
  return tool.icon || tool.glyph || tool.swatch || tool.dot ? shared.btnIcononly : s.charBtn;
}

function OptionButton({ opt, onPick }) {
  let face;
  if (opt.swatch) face = <span className={s.swatch} style={{ background: opt.swatch }} />;
  else if (opt.dot) face = <span className={s.dot} style={{ width: opt.dot, height: opt.dot }} />;
  else face = <Face icon={opt.icon} char={opt.char} glyph={opt.glyph} dim={opt.dim} dy={opt.dy} />;
  const cls = [
    opt.icon || opt.glyph || opt.swatch || opt.dot ? shared.btnIcononly : s.charBtn,
    opt.selected && s.selected,
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <TooltipTrigger delay={450}>
      <ActionButton isQuiet size="L" aria-label={opt.label} UNSAFE_className={cls} onPress={onPick}>
        {face}
      </ActionButton>
      <Tooltip>{opt.label}</Tooltip>
    </TooltipTrigger>
  );
}

function ToolView({ tool, open, onToggle, close }) {
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

export default function Toolbar({ label, tools }) {
  const [openId, setOpenId] = useState(null);
  const ref = useRef(null);

  // Collapse the open group/input on any click outside the strip.
  useEffect(() => {
    if (openId == null) return;
    function onDown(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpenId(null);
    }
    document.addEventListener("mousedown", onDown, true);
    return () => document.removeEventListener("mousedown", onDown, true);
  }, [openId]);

  return (
    <div ref={ref} className={`${shared.toolStrip} no-print`} role="toolbar" aria-label={label}>
      {tools.filter(Boolean).map((t, i) => (
        <ToolView
          key={t.id || i}
          tool={t}
          open={openId === t.id}
          onToggle={() => setOpenId((o) => (o === t.id ? null : t.id))}
          close={() => setOpenId(null)}
        />
      ))}
    </div>
  );
}
