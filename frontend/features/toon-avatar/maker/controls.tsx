import { useId, useRef, useState, type KeyboardEvent } from "react";
import styled, { css } from "styled-components";
import { baseTokens as base, lobbyTokens as lobby } from "@styles/tokens";
import { normalizeHex } from "../recipe";
import { hexToHsl, hslToHex } from "./color";

const focusRing = css`
    &:focus-visible {
        outline: ${base.focus.width}px solid ${base.color.accent};
        outline-offset: ${base.focus.offset}px;
    }
`;

const Label = styled.span`
    font-size: ${base.font.size.sm}px;
    color: ${lobby.color.controlInk};
`;

const Value = styled.span`
    font: ${base.font.size.xs}px ${base.font.mono};
    color: ${lobby.color.meta};
    font-variant-numeric: tabular-nums;
`;

const Row = styled.div`
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 4px;
`;

const track = css`
    height: 4px;
    border-radius: 2px;
`;
const thumb = css`
    appearance: none;
    width: 16px;
    height: 16px;
    border: 2px solid ${base.color.ink};
    border-radius: 50%;
    background: ${lobby.control.pressed};
    box-shadow: 0 1px 3px #00000066;
    transition: transform ${base.motion.fast}ms ${base.motion.ease};
`;

const Range = styled.input<{ $track?: string }>`
    appearance: none;
    display: block;
    width: 100%;
    height: 20px;
    margin: 0;
    background: transparent;
    cursor: pointer;
    touch-action: pan-y;
    &::-webkit-slider-runnable-track {
        ${track}
        background: ${(p) =>
            p.$track ||
            `linear-gradient(to right, ${base.color.secondary} var(--fill), ${base.color.line.default} var(--fill))`};
    }
    &::-moz-range-track {
        ${track}
        background: ${(p) =>
            p.$track ||
            `linear-gradient(to right, ${base.color.secondary} var(--fill), ${base.color.line.default} var(--fill))`};
    }
    &::-webkit-slider-thumb {
        ${thumb}
        margin-top: -6px;
    }
    &::-moz-range-thumb {
        ${thumb}
        box-sizing: border-box;
    }
    &:hover::-webkit-slider-thumb,
    &:active::-webkit-slider-thumb {
        transform: scale(1.15);
    }
    &:focus-visible {
        outline: none;
    }
    &:focus-visible::-webkit-slider-thumb {
        outline: ${base.focus.width}px solid ${base.color.accent};
        outline-offset: ${base.focus.offset}px;
    }
    &:focus-visible::-moz-range-thumb {
        outline: ${base.focus.width}px solid ${base.color.accent};
        outline-offset: ${base.focus.offset}px;
    }
    @media (prefers-reduced-motion: reduce) {
        &::-webkit-slider-thumb {
            transition: none;
        }
    }
`;

const Field = styled.div`
    margin-bottom: 12px;
`;

/** A 0..1 slider. Double-click (or Delete) puts it back to its default. */
export function Slider(props: {
    label: string;
    value: number;
    reset: number;
    onChange(value: number, dragging: boolean): void;
    onCommit(): void;
}) {
    const { label, value, reset, onChange, onCommit } = props;
    const id = useId();
    const percent = Math.round(value * 100);
    return (
        <Field>
            <Row>
                <Label as="label" htmlFor={id}>
                    {label}
                </Label>
                <Value>{percent}</Value>
            </Row>
            <Range
                id={id}
                type="range"
                min={0}
                max={100}
                step={1}
                value={percent}
                style={{ ["--fill" as string]: `${percent}%` }}
                onChange={(event) =>
                    onChange(Number(event.target.value) / 100, true)
                }
                onPointerUp={onCommit}
                onKeyUp={onCommit}
                onBlur={onCommit}
                onDoubleClick={() => onChange(reset, false)}
                onKeyDown={(event) => {
                    if (event.key === "Delete" || event.key === "Backspace")
                        onChange(reset, false);
                }}
                title="Double-click to reset"
            />
        </Field>
    );
}

const Tiles = styled.div`
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(84px, 1fr));
    gap: 6px;
    margin-bottom: 12px;
`;

const Tile = styled.button<{ $on: boolean }>`
    min-height: 36px;
    padding: 6px 8px;
    border: 1px solid
        ${(p) => (p.$on ? lobby.panel.cardSelected : lobby.control.border)};
    border-radius: ${base.radius.inset}px;
    background: ${(p) => (p.$on ? lobby.control.pressed : "transparent")};
    color: ${(p) => (p.$on ? base.color.ink : lobby.color.secondary)};
    font: ${base.font.weight.medium} ${base.font.size.sm}px / 1.2
        var(--oc-font, ${base.font.sans});
    text-align: center;
    cursor: pointer;
    transition: background ${base.motion.fast}ms ${base.motion.ease},
        border-color ${base.motion.fast}ms ${base.motion.ease};
    &:hover {
        background: ${(p) =>
            p.$on ? lobby.control.pressed : lobby.control.hover};
        border-color: ${(p) =>
            p.$on ? lobby.panel.cardSelected : lobby.control.hoverBorder};
    }
    ${focusRing}
    @media (prefers-reduced-motion: reduce) {
        transition: none;
    }
`;

/** Moves focus between siblings with the arrow keys, like a radio group. */
function rove(event: KeyboardEvent<HTMLElement>) {
    const keys: Record<string, number> = {
        ArrowRight: 1,
        ArrowDown: 1,
        ArrowLeft: -1,
        ArrowUp: -1,
    };
    const items = Array.from(
        event.currentTarget.querySelectorAll<HTMLElement>('[role="radio"]')
    );
    const at = items.indexOf(document.activeElement as HTMLElement);
    if (at < 0) return;
    let next = -1;
    if (event.key in keys)
        next = (at + keys[event.key] + items.length) % items.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = items.length - 1;
    if (next < 0) return;
    event.preventDefault();
    items[next].focus();
    items[next].click();
}

export function Choice(props: {
    label: string;
    options: readonly string[];
    value: string;
    format(option: string): string;
    onChange(option: string): void;
}) {
    const { label, options, value, format, onChange } = props;
    return (
        <Tiles role="radiogroup" aria-label={label} onKeyDown={rove}>
            {options.map((option) => (
                <Tile
                    key={option}
                    type="button"
                    role="radio"
                    aria-checked={option === value}
                    tabIndex={option === value ? 0 : -1}
                    $on={option === value}
                    onClick={() => onChange(option)}
                >
                    {format(option)}
                </Tile>
            ))}
        </Tiles>
    );
}

const Swatches = styled.div`
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 8px;
`;

const Swatch = styled.button<{ $on: boolean }>`
    position: relative;
    width: 28px;
    height: 28px;
    padding: 0;
    border: 1px solid ${base.color.line.strong};
    border-radius: 50%;
    cursor: pointer;
    box-shadow: ${(p) =>
        p.$on
            ? `0 0 0 2px ${lobby.glass.fallback}, 0 0 0 4px ${base.color.ink}`
            : "none"};
    ${focusRing}
    &:focus-visible {
        outline-offset: ${base.focus.offsetLoose + 2}px;
    }
`;

const Custom = styled.button<{ $on: boolean }>`
    height: 28px;
    padding: 0 10px;
    border: 1px solid
        ${(p) => (p.$on ? lobby.panel.cardSelected : lobby.control.border)};
    border-radius: 14px;
    background: ${(p) => (p.$on ? lobby.control.pressed : "transparent")};
    color: ${lobby.color.secondary};
    font: ${base.font.size.xs}px var(--oc-font, ${base.font.sans});
    cursor: pointer;
    &:hover {
        background: ${lobby.control.hover};
    }
    ${focusRing}
`;

const Mixer = styled.div`
    padding: 10px 12px 6px;
    margin-bottom: 8px;
    border: 1px solid ${lobby.control.border};
    border-radius: ${base.radius.inset}px;
`;

const Hex = styled.input`
    width: 88px;
    height: 28px;
    padding: 0 8px;
    border: 1px solid ${lobby.control.border};
    border-radius: ${base.radius.inset}px;
    background: transparent;
    color: ${base.color.ink};
    font: ${base.font.size.sm}px ${base.font.mono};
    ${focusRing}
`;

/** Palette swatches, plus hue, saturation and lightness for any other colour. */
export function ColorPicker(props: {
    label: string;
    value: string;
    palette: string[];
    onChange(value: string, dragging: boolean): void;
    onCommit(): void;
}) {
    const { label, value, palette, onChange, onCommit } = props;
    const [open, setOpen] = useState(false);
    const [draft, setDraft] = useState<string | null>(null);
    // Keep the hue while saturation or lightness passes through grey.
    const hue = useRef(hexToHsl(value).h);
    const hsl = hexToHsl(value);
    if (hsl.s > 0.02 && hsl.l > 0.02 && hsl.l < 0.98) hue.current = hsl.h;
    const h = hue.current;
    const mix = (part: Partial<typeof hsl>) =>
        onChange(hslToHex({ h, s: hsl.s, l: hsl.l, ...part }), true);
    const inPalette = palette.includes(value);
    const range = (
        name: string,
        max: number,
        current: number,
        trackColors: string,
        apply: (v: number) => void
    ) => (
        <Range
            type="range"
            aria-label={`${label}: ${name}`}
            min={0}
            max={max}
            value={Math.round(current)}
            $track={trackColors}
            onChange={(event) => apply(Number(event.target.value))}
            onPointerUp={onCommit}
            onKeyUp={onCommit}
            onBlur={onCommit}
        />
    );
    return (
        <Field>
            <Row>
                <Label>{label}</Label>
                <Value>{value}</Value>
            </Row>
            <Swatches role="radiogroup" aria-label={label} onKeyDown={rove}>
                {palette.map((color) => (
                    <Swatch
                        key={color}
                        type="button"
                        role="radio"
                        aria-checked={color === value}
                        aria-label={color}
                        tabIndex={
                            color === value ||
                            (!inPalette && color === palette[0])
                                ? 0
                                : -1
                        }
                        $on={color === value}
                        style={{ background: color }}
                        onClick={() => onChange(color, false)}
                    />
                ))}
                <Custom
                    type="button"
                    aria-expanded={open}
                    $on={open || !inPalette}
                    onClick={() => setOpen((v) => !v)}
                >
                    Mix
                </Custom>
            </Swatches>
            {open && (
                <Mixer>
                    {range(
                        "hue",
                        359,
                        h,
                        "linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)",
                        (v) => {
                            hue.current = v;
                            mix({ h: v, s: Math.max(hsl.s, 0.05) });
                        }
                    )}
                    {range(
                        "saturation",
                        100,
                        hsl.s * 100,
                        `linear-gradient(to right, ${hslToHex({
                            h,
                            s: 0,
                            l: hsl.l,
                        })}, ${hslToHex({ h, s: 1, l: hsl.l })})`,
                        (v) => mix({ s: v / 100 })
                    )}
                    {range(
                        "lightness",
                        100,
                        hsl.l * 100,
                        `linear-gradient(to right, #000, ${hslToHex({
                            h,
                            s: hsl.s,
                            l: 0.5,
                        })}, #fff)`,
                        (v) => mix({ l: v / 100 })
                    )}
                    <Hex
                        aria-label={`${label}: hex code`}
                        value={draft ?? value}
                        spellCheck={false}
                        maxLength={7}
                        onChange={(event) => {
                            setDraft(event.target.value);
                            const hex = normalizeHex(event.target.value);
                            if (
                                hex &&
                                event.target.value.replace("#", "").length === 6
                            )
                                onChange(hex, false);
                        }}
                        onBlur={() => setDraft(null)}
                    />
                </Mixer>
            )}
        </Field>
    );
}
