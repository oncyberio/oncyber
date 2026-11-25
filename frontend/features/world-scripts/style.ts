/**
 * tokens-ok-file: palettes for the 3D things a script makes, not interface
 * colours.
 *
 * A world's creative direction: the palette, look and feel every object a
 * script makes should share, so "add coins" in a Starry Night world gives
 * painted, swirling gold coins and not plain yellow rings.
 *
 * The model writes it with the first script, from what the world already
 * is (its title, place, sky and fog colours, artwork names); the creator
 * can change it. It is saved on the space (`exhibits/{id}.worldStyle`),
 * handed to every later request, and given to the script as `world.style`.
 * Objects with `look: "style"` (the default) are drawn with it.
 */
import { cleanColor, cleanText, THING_LOOKS, ThingLook } from "./basics";

export interface WorldStyle {
    /** One or two sentences of creative direction, in words. */
    summary: string;
    /** 3–8 colours, main first. */
    palette: string[];
    /** The default surface for new objects. */
    look: Exclude<ThingLook, "style">;
    /** 0–1: how visible the brushwork is on "painted" surfaces. */
    strokes: number;
    /** 0–1: how much things sway by default. */
    wobble: number;
    /** Dark outlines around shapes, as in a drawing. */
    outline: boolean;
}

export const NEUTRAL_STYLE: WorldStyle = {
    summary: "Clean, friendly shapes with soft light.",
    palette: ["#f2f2f2", "#2567ff", "#ffc400", "#ff3b3b", "#34c759"],
    look: "matte",
    strokes: 0.5,
    wobble: 0,
    outline: false,
};

function clamp01(value: unknown, fallback: number) {
    return typeof value === "number" && Number.isFinite(value)
        ? Math.min(1, Math.max(0, value))
        : fallback;
}

/** A style from anywhere (the model, the creator, a saved space), checked. */
export function cleanStyle(raw: unknown): WorldStyle | null {
    if (!raw || typeof raw !== "object") return null;
    const input = raw as Record<string, unknown>;
    const palette = (Array.isArray(input.palette) ? input.palette : [])
        .map(cleanColor)
        .filter(Boolean)
        .slice(0, 8);
    if (palette.length < 2) return null;
    const look = THING_LOOKS.includes(input.look as ThingLook)
        ? (input.look as ThingLook)
        : "matte";
    return {
        summary: cleanText(input.summary, 300).trim() || NEUTRAL_STYLE.summary,
        palette,
        look: look === "style" ? "matte" : look,
        strokes: clamp01(input.strokes, 0.5),
        wobble: clamp01(input.wobble, 0),
        outline: input.outline === true,
    };
}

/** What the model is told about the world when it has no style yet. */
export interface WorldContext {
    title?: string;
    place?: string;
    sky?: string;
    fog?: string;
    artworks?: string[];
}

export function describeWorld(context: WorldContext) {
    const lines = [
        context.title && `Title: ${cleanText(context.title, 120)}`,
        context.place && `Built in: ${cleanText(context.place, 120)}`,
        context.sky && `Sky / background colour: ${context.sky}`,
        context.fog && `Fog colour: ${context.fog}`,
        context.artworks?.length &&
            `Some artworks: ${context.artworks
                .slice(0, 20)
                .map((name) => cleanText(name, 60))
                .join("; ")}`,
    ].filter(Boolean);
    return lines.join("\n");
}
