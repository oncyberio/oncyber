/**
 * The words of a "text" thing, drawn into a texture: up to six lines, in
 * the thing's colours. Drawn again into the same canvas when they change.
 */
import { CanvasTexture, SRGBColorSpace } from "three";
import type { ThingProps } from "../protocol";

export function drawText(props: ThingProps, texture?: CanvasTexture) {
    const canvas =
        (texture?.image as HTMLCanvasElement) ||
        document.createElement("canvas");
    const text = props.text || "";
    const lines = text.split("\n").slice(0, 6);
    const font = 64;
    const context = canvas.getContext("2d");
    context.font = `600 ${font}px Aeonik, "Helvetica Neue", Arial, sans-serif`;
    const width = Math.max(
        64,
        ...lines.map((line) => context.measureText(line).width)
    );
    canvas.width = Math.ceil(width + font);
    canvas.height = Math.ceil(lines.length * font * 1.25 + font * 0.5);
    context.font = `600 ${font}px Aeonik, "Helvetica Neue", Arial, sans-serif`;
    if (props.background) {
        context.fillStyle = props.background;
        context.fillRect(0, 0, canvas.width, canvas.height);
    }
    // tokens-ok: text drawn into a 3D texture
    context.fillStyle = props.textColor || "#ffffff";
    context.textBaseline = "top";
    context.textAlign = "center";
    lines.forEach((line, i) =>
        context.fillText(line, canvas.width / 2, font * 0.25 + i * font * 1.25)
    );
    const next = texture || new CanvasTexture(canvas);
    next.colorSpace = SRGBColorSpace;
    next.needsUpdate = true;
    return { texture: next, aspect: canvas.width / canvas.height };
}
