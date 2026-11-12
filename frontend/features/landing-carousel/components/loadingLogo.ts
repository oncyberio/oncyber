import { scrollLogoPose } from "./cyberloopMorph";

// The header's scroll morph, played on its own while a space loads: the new
// logo spins, turns into the old one as the spin eases out, holds, and turns
// back.
export const SPIN_MS = 2000;
export const SPIN_TURNS = 2;
export const MORPH_MS = 1200;
// The morph to the old logo starts this long before the spin ends, so the
// logo changes while it slows down rather than after it stops.
export const MORPH_OVERLAP_MS = 700;
export const HOLD_MS = 1500;
const MORPH_START = SPIN_MS - MORPH_OVERLAP_MS;
const HOLD_START = MORPH_START + MORPH_MS;
const BACK_START = HOLD_START + HOLD_MS;
export const CYCLE_MS = BACK_START + MORPH_MS;

const smooth = (x: number) => x * x * (3 - 2 * x);
const clamp = (x: number) => Math.max(0, Math.min(1, x));

/** Logo shape (morph 1 is the new logo) and rotation `ms` into the loop. */
export function loadingLogoPose(ms: number, reducedMotion = false) {
    if (reducedMotion) return { morph: 1, angle: 0 };
    const t = ((ms % CYCLE_MS) + CYCLE_MS) % CYCLE_MS;
    // Whole eased turns, so every cycle starts and ends at the same angle.
    const spin = -360 * SPIN_TURNS * smooth(clamp(t / SPIN_MS));
    if (t < MORPH_START) return { morph: 1, angle: spin };
    // The morph itself turns the mark half way (0 to 180). Mirrored on the
    // way to the old logo, it keeps turning the same way as the spin.
    if (t < HOLD_START) {
        const morph = 1 - (t - MORPH_START) / MORPH_MS;
        return { morph, angle: spin - scrollLogoPose(morph).angle };
    }
    if (t < BACK_START) return { morph: 0, angle: -180 };
    const morph = (t - BACK_START) / MORPH_MS;
    return { morph, angle: scrollLogoPose(morph).angle };
}

// Shared clock, so the page's loading screen and the engine's pick up the
// loop where the other left it instead of restarting it.
let epoch = 0;
let running = 0;
let lastStop = -Infinity;

const SVG = "http://www.w3.org/2000/svg";

export type LoadingLogo = {
    element: SVGSVGElement;
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

    const svg = document.createElementNS(SVG, "svg");
    svg.setAttribute("viewBox", "-180 -180 360 360");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    svg.dataset.loadingLogo = "";
    Object.assign(svg.style, {
        position: "absolute",
        left: "50%",
        top: "50%",
        width: "50px",
        height: "50px",
        margin: "-25px 0 0 -25px",
        color: "#fff",
        pointerEvents: "none",
        zIndex: "1",
        opacity: "1",
    });
    const group = document.createElementNS(SVG, "g");
    svg.append(group);
    const paths: SVGPathElement[] = [];

    let frame = 0;
    let removed = false;
    const draw = () => {
        const { morph, angle } = loadingLogoPose(
            performance.now() - epoch,
            reduced
        );
        scrollLogoPose(morph).paths.forEach((d, index) => {
            let path = paths[index];
            if (!path) {
                path = paths[index] = document.createElementNS(SVG, "path");
                path.setAttribute("fill", "currentColor");
                group.append(path);
            }
            if (path.getAttribute("d") !== d) path.setAttribute("d", d);
        });
        group.setAttribute("transform", `rotate(${angle.toFixed(2)})`);
    };
    const tick = () => {
        frame = 0;
        if (removed) return;
        draw();
        if (!reduced) frame = requestAnimationFrame(tick);
    };
    tick();
    parent.append(svg);

    let fadeTimer: ReturnType<typeof setTimeout>;
    const remove = () => {
        if (removed) return;
        removed = true;
        cancelAnimationFrame(frame);
        clearTimeout(fadeTimer);
        svg.remove();
        running--;
        lastStop = performance.now();
    };
    const fadeOut = (ms = 400) => {
        if (removed) return;
        svg.style.transition = `opacity ${ms}ms ease-out`;
        svg.style.opacity = "0";
        fadeTimer = setTimeout(remove, ms);
    };
    return { element: svg, fadeOut, remove };
}
