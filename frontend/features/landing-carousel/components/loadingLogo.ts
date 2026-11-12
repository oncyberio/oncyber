import { scrollLogoPose } from "./cyberloopMorph";

// The loading logo: the Cyberloop frame sequence plays (the same sprite the
// header plays) up to its rest frame, where the mark
// morphs into the old oncyber logo as the header's scroll does, holds, and
// morphs back. The sequence then plays backwards to where it started, so the
// loop never cuts.
const SPRITE = "/brand/cyberloop-sprite.webp";
const GRID = 15;
export const FRAME_COUNT = 225;
// The sequence is authored at 30 fps; the loader plays it 30% quicker.
export const FRAME_MS = 1000 / 43;
// The frame the header rests on, and the one the SVG morph draws at morph 1.
export const REST_FRAME = 90;
// Frames of the sequence played before the morph (and again, reversed,
// after it): about 1 s each way.
export const LOOP_FRAMES = 45;
export const LOOP_MS = LOOP_FRAMES * FRAME_MS;
export const MORPH_MS = 840;
export const HOLD_MS = 1050;
const HOLD_START = LOOP_MS + MORPH_MS;
const BACK_START = HOLD_START + HOLD_MS;
const REWIND_START = BACK_START + MORPH_MS;
export const CYCLE_MS = REWIND_START + LOOP_MS;

export type LoadingLogoPose =
    | { phase: "loop"; frame: number }
    | { phase: "morph"; morph: number; angle: number };

const frameAt = (offset: number) =>
    (((REST_FRAME + offset) % FRAME_COUNT) + FRAME_COUNT) % FRAME_COUNT;

/** What to show `ms` into the loop: a sprite frame, or a morph pose. */
export function loadingLogoPose(
    ms: number,
    reducedMotion = false
): LoadingLogoPose {
    if (reducedMotion) return { phase: "loop", frame: REST_FRAME };
    const t = ((ms % CYCLE_MS) + CYCLE_MS) % CYCLE_MS;
    if (t < LOOP_MS) {
        const played = Math.min(LOOP_FRAMES, Math.floor(t / FRAME_MS) + 1);
        return { phase: "loop", frame: frameAt(played - LOOP_FRAMES) };
    }
    if (t >= REWIND_START) {
        const played = Math.floor((t - REWIND_START) / FRAME_MS);
        return { phase: "loop", frame: frameAt(-played) };
    }
    // The scroll pose turns the mark from 0 (loop) to 180 (old logo).
    let morph: number;
    if (t < HOLD_START) morph = 1 - (t - LOOP_MS) / MORPH_MS;
    else if (t < BACK_START) morph = 0;
    else morph = (t - BACK_START) / MORPH_MS;
    return { phase: "morph", morph, angle: scrollLogoPose(morph).angle };
}

// Shared clock, so the page's loading screen and the engine's pick up the
// loop where the other left it instead of restarting it.
let epoch = 0;
let running = 0;
let lastStop = -Infinity;

const SVG = "http://www.w3.org/2000/svg";
const SIZE = 50;

export type LoadingLogo = {
    element: HTMLElement;
    fadeOut: (ms?: number) => void;
    remove: () => void;
};

/** Mounts the logo in the middle of `parent` and plays the loop on it. */
export function startLoadingLogo(parent: HTMLElement): LoadingLogo {
    const now = performance.now();
    if (!running && now - lastStop > 1000) epoch = now;
    running++;

    const reduced =
        typeof matchMedia === "function" &&
        matchMedia("(prefers-reduced-motion: reduce)").matches;

    const box = document.createElement("span");
    box.dataset.loadingLogo = "";
    box.setAttribute("aria-hidden", "true");
    Object.assign(box.style, {
        position: "absolute",
        left: "50%",
        top: "50%",
        width: `${SIZE}px`,
        height: `${SIZE}px`,
        margin: `${-SIZE / 2}px 0 0 ${-SIZE / 2}px`,
        color: "#fff",
        pointerEvents: "none",
        zIndex: "1",
        opacity: "1",
    });

    const sprite = document.createElement("span");
    Object.assign(sprite.style, {
        position: "absolute",
        inset: "0",
        backgroundImage: `url("${SPRITE}")`,
        backgroundSize: `${GRID * 100}% ${GRID * 100}%`,
        backgroundRepeat: "no-repeat",
    });

    const svg = document.createElementNS(SVG, "svg");
    svg.setAttribute("viewBox", "-180 -180 360 360");
    svg.setAttribute("focusable", "false");
    Object.assign(svg.style, {
        position: "absolute",
        inset: "0",
        width: "100%",
        height: "100%",
        display: "none",
    });
    const group = document.createElementNS(SVG, "g");
    svg.append(group);
    const paths: SVGPathElement[] = [];
    box.append(sprite, svg);

    let frame = 0;
    let removed = false;
    let shownFrame = -1;
    const draw = () => {
        const pose = loadingLogoPose(performance.now() - epoch, reduced);
        if (pose.phase === "loop") {
            if (shownFrame !== pose.frame) {
                shownFrame = pose.frame;
                sprite.style.backgroundPosition = `${
                    ((pose.frame % GRID) / (GRID - 1)) * 100
                }% ${(Math.floor(pose.frame / GRID) / (GRID - 1)) * 100}%`;
            }
            sprite.style.display = "";
            svg.style.display = "none";
            return;
        }
        scrollLogoPose(pose.morph).paths.forEach((d, index) => {
            let path = paths[index];
            if (!path) {
                path = paths[index] = document.createElementNS(SVG, "path");
                path.setAttribute("fill", "currentColor");
                group.append(path);
            }
            if (path.getAttribute("d") !== d) path.setAttribute("d", d);
        });
        group.setAttribute("transform", `rotate(${pose.angle.toFixed(2)})`);
        sprite.style.display = "none";
        svg.style.display = "";
    };
    const tick = () => {
        frame = 0;
        if (removed) return;
        draw();
        if (!reduced) frame = requestAnimationFrame(tick);
    };
    tick();
    parent.append(box);

    let fadeTimer: ReturnType<typeof setTimeout>;
    const remove = () => {
        if (removed) return;
        removed = true;
        cancelAnimationFrame(frame);
        clearTimeout(fadeTimer);
        box.remove();
        running--;
        lastStop = performance.now();
    };
    const fadeOut = (ms = 400) => {
        if (removed) return;
        box.style.transition = `opacity ${ms}ms ease-out`;
        box.style.opacity = "0";
        fadeTimer = setTimeout(remove, ms);
    };
    return { element: box, fadeOut, remove };
}
