"use client";

import { useId, useRef, useState } from "react";
import { Check, Pipette } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { hexToHsv, hsvToHex, hsvToRgb } from "@/lib/color";
import {
  normalizeHexColor,
  SUBJECT_COLOR_HEX,
  SUBJECT_COLOR_META,
  SUBJECT_COLORS,
  type SubjectColorPreset,
  type SubjectColorValue,
} from "@/lib/subjects";
import { cn } from "@/lib/utils";

const DEFAULT_PRESET: SubjectColorPreset = "teal";

function hueCss(h: number) {
  const { r, g, b } = hsvToRgb(h, 1, 1);
  return `rgb(${Math.round(r)} ${Math.round(g)} ${Math.round(b)})`;
}

function initialHex(value: SubjectColorValue) {
  if (SUBJECT_COLORS.includes(value as SubjectColorPreset)) {
    return SUBJECT_COLOR_HEX[value as SubjectColorPreset];
  }
  return normalizeHexColor(String(value)) ?? SUBJECT_COLOR_HEX[DEFAULT_PRESET];
}

type ColorPickerProps = {
  value: SubjectColorValue;
  onChange: (value: SubjectColorValue) => void;
};

export function SubjectColorPicker({ value, onChange }: ColorPickerProps) {
  const customOpenId = useId();
  const isPreset = SUBJECT_COLORS.includes(value as SubjectColorPreset);
  const currentHex = initialHex(value);
  const [pickerOpen, setPickerOpen] = useState(!isPreset);
  const customOpen = !isPreset || pickerOpen;
  const [hsv, setHsv] = useState(() => hexToHsv(currentHex) ?? { h: 174, s: 0.6, v: 0.61 });
  const [hexDraft, setHexDraft] = useState(currentHex);
  const [hexError, setHexError] = useState<string | null>(null);

  const applyHsv = (next: { h: number; s: number; v: number }) => {
    setHsv(next);
    const hex = hsvToHex(next.h, next.s, next.v);
    setHexDraft(hex);
    setHexError(null);
    onChange(hex);
  };

  const applyHex = (raw: string) => {
    setHexDraft(raw);
    const normalized = normalizeHexColor(raw);
    if (!normalized) {
      setHexError("Use a 6-digit HEX colour, e.g. #3E9C96");
      return;
    }
    setHexError(null);
    const next = hexToHsv(normalized);
    if (next) setHsv(next);
    onChange(normalized);
  };

  const selectPreset = (preset: SubjectColorPreset) => {
    setPickerOpen(false);
    setHexError(null);
    const hex = SUBJECT_COLOR_HEX[preset];
    const next = hexToHsv(hex);
    if (next) setHsv(next);
    setHexDraft(hex);
    onChange(preset);
  };

  const openCustom = () => {
    setPickerOpen(true);
    const hex = hsvToHex(hsv.h, hsv.s, hsv.v);
    setHexDraft(hex);
    onChange(hex);
  };

  const resetPreset = () => selectPreset(DEFAULT_PRESET);

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-[13px] font-medium text-ink-2">Colour</legend>
      <div role="radiogroup" aria-label="Colour" className="flex flex-wrap gap-2.5">
        {SUBJECT_COLORS.map((c) => {
          const selected = isPreset && value === c;
          return (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={SUBJECT_COLOR_META[c].label}
              title={SUBJECT_COLOR_META[c].label}
              onClick={() => selectPreset(c)}
              className="flex size-10 items-center justify-center rounded-full outline-none focus-visible:shadow-[0_0_0_2px_var(--raised),0_0_0_4px_var(--accent)]"
            >
              <span
                className="flex size-[30px] items-center justify-center rounded-full text-white transition-shadow"
                style={{
                  background: SUBJECT_COLOR_META[c].swatch,
                  boxShadow: selected
                    ? `0 0 0 3px var(--raised), 0 0 0 5px ${SUBJECT_COLOR_META[c].swatch}`
                    : undefined,
                }}
              >
                {selected ? <Check className="size-3.5" strokeWidth={3} aria-hidden /> : null}
              </span>
            </button>
          );
        })}
        <button
          type="button"
          role="radio"
          aria-checked={!isPreset}
          aria-controls={customOpen ? customOpenId : undefined}
          aria-label="Custom colour"
          title="Custom colour"
          onClick={openCustom}
          className="flex size-10 items-center justify-center rounded-full outline-none focus-visible:shadow-[0_0_0_2px_var(--raised),0_0_0_4px_var(--accent)]"
        >
          <span
            className={cn(
              "flex size-[30px] items-center justify-center rounded-full border border-hairline bg-sunken text-ink-2 transition-shadow",
              (!isPreset || customOpen) &&
                "shadow-[0_0_0_3px_var(--raised),0_0_0_5px_var(--accent)]",
            )}
            style={!isPreset ? { background: currentHex, color: "white", border: "none" } : undefined}
          >
            <Pipette className="size-3.5" aria-hidden />
          </span>
        </button>
      </div>

      {customOpen ? (
        <div
          id={customOpenId}
          className="mt-2 flex flex-col gap-3 rounded-[16px] bg-sunken p-3"
        >
          <div className="flex items-center gap-3">
            <span
              aria-hidden
              className="size-11 shrink-0 rounded-[14px] shadow-[0_0_0_1px_var(--hairline)]"
              style={{ background: hsvToHex(hsv.h, hsv.s, hsv.v) }}
            />
            <p className="min-w-0 flex-1 text-[13px] text-ink-2">
              Live preview · HEX {hsvToHex(hsv.h, hsv.s, hsv.v)}
            </p>
            <Button type="button" variant="ghost" size="sm" onClick={resetPreset}>
              Reset
            </Button>
          </div>

          <SvPlane
            hue={hsv.h}
            saturation={hsv.s}
            value={hsv.v}
            onChange={(s, v) => applyHsv({ ...hsv, s, v })}
          />

          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-medium text-ink-2">Hue</span>
            <input
              type="range"
              min={0}
              max={360}
              step={1}
              value={Math.round(hsv.h)}
              aria-valuetext={`${Math.round(hsv.h)} degrees`}
              onChange={(e) => applyHsv({ ...hsv, h: Number(e.target.value) })}
              className="h-3 w-full cursor-pointer appearance-none rounded-full outline-none focus-visible:shadow-[0_0_0_2px_var(--raised),0_0_0_4px_var(--accent)] [&::-webkit-slider-thumb]:size-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-[0_0_0_1px_rgba(0,0,0,.2)]"
              style={{
                background:
                  "linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)",
              }}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-medium text-ink-2">HEX</span>
            <Input
              value={hexDraft}
              spellCheck={false}
              autoCapitalize="characters"
              aria-invalid={Boolean(hexError)}
              aria-describedby={hexError ? `${customOpenId}-hex-error` : undefined}
              onChange={(e) => applyHex(e.target.value)}
              className="font-mono uppercase"
              maxLength={7}
            />
            {hexError ? (
              <span id={`${customOpenId}-hex-error`} className="text-[12px] text-danger">
                {hexError}
              </span>
            ) : null}
          </label>
        </div>
      ) : null}
    </fieldset>
  );
}

function SvPlane({
  hue,
  saturation,
  value,
  onChange,
}: {
  hue: number;
  saturation: number;
  value: number;
  onChange: (s: number, v: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const pick = (clientX: number, clientY: number) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const s = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    const v = Math.min(1, Math.max(0, 1 - (clientY - rect.top) / rect.height));
    onChange(s, v);
  };

  return (
    <div
      ref={ref}
      role="slider"
      tabIndex={0}
      aria-label="Saturation and brightness"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(saturation * 50 + value * 50)}
      aria-valuetext={`Saturation ${Math.round(saturation * 100)}%, brightness ${Math.round(value * 100)}%`}
      className="relative h-36 w-full touch-none rounded-[12px] outline-none focus-visible:shadow-[0_0_0_2px_var(--raised),0_0_0_4px_var(--accent)]"
      style={{
        background: `
          linear-gradient(to top, #000, transparent),
          linear-gradient(to right, #fff, ${hueCss(hue)})
        `,
      }}
      onPointerDown={(e) => {
        dragging.current = true;
        e.currentTarget.setPointerCapture(e.pointerId);
        pick(e.clientX, e.clientY);
      }}
      onPointerMove={(e) => {
        if (!dragging.current) return;
        pick(e.clientX, e.clientY);
      }}
      onPointerUp={() => {
        dragging.current = false;
      }}
      onPointerCancel={() => {
        dragging.current = false;
      }}
      onKeyDown={(e) => {
        const step = e.shiftKey ? 0.05 : 0.02;
        if (e.key === "ArrowRight") {
          e.preventDefault();
          onChange(Math.min(1, saturation + step), value);
        } else if (e.key === "ArrowLeft") {
          e.preventDefault();
          onChange(Math.max(0, saturation - step), value);
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          onChange(saturation, Math.min(1, value + step));
        } else if (e.key === "ArrowDown") {
          e.preventDefault();
          onChange(saturation, Math.max(0, value - step));
        }
      }}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,.25)]"
        style={{
          left: `${saturation * 100}%`,
          top: `${(1 - value) * 100}%`,
          background: hsvToHex(hue, saturation, value),
        }}
      />
    </div>
  );
}
