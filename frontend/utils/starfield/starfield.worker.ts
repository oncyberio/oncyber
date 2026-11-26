/// <reference lib="webworker" />
/**
 * Draws the loading stars off the page's main thread (./startStarfield.ts).
 * The page hands over its canvas; from then on a held main thread (the
 * page starting up, a route changing) does not hold the stars.
 */
import { pacing, paintStars, starClock } from "./stars";

declare const self: DedicatedWorkerGlobalScope;

let canvas: OffscreenCanvas | null = null;
let context: OffscreenCanvasRenderingContext2D | null = null;
let width = 1;
let height = 1;
let pixels = 1;
let running = false;
let paced = pacing();

const next = (run: () => void) =>
    typeof self.requestAnimationFrame === "function"
        ? self.requestAnimationFrame(run)
        : setTimeout(run, 16);

function frame() {
    if (!running || !canvas || !context) return;
    paced.frame(performance.now());
    paintStars(context as any, width, height, pixels, starClock());
    next(frame);
}

function size(message: { width: number; height: number; pixels: number }) {
    width = Math.max(1, message.width);
    height = Math.max(1, message.height);
    pixels = message.pixels;
    if (!canvas) return;
    canvas.width = Math.round(width * pixels);
    canvas.height = Math.round(height * pixels);
}

self.onmessage = (event: MessageEvent) => {
    const message = event.data || {};
    if (message.type === "start") {
        canvas = message.canvas;
        context = canvas?.getContext("2d") || null;
        size(message);
        paced = pacing();
        running = true;
        next(frame);
    } else if (message.type === "size") {
        size(message);
    } else if (message.type === "stop") {
        running = false;
        self.postMessage({ type: "pacing", pacing: paced.read() });
        self.close();
    }
};
