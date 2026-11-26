/**
 * tokens-ok-file: the colours of stars in a loading animation, not of the
 * interface.
 *
 * The stars shown while a world loads, as a function of the clock.
 *
 * The page's first star field (`drawStarfield`) moved its stars a step for
 * every frame it drew, behind a 30 frames a second timer. A held frame
 * slowed the stars, and the timer beating against the screen's own rate
 * made the pace uneven even when nothing was held. Here a star is where
 * the time says it is: draw it at any rate, skip any frame, and it moves at
 * the same speed. Two canvases, or two documents, asked at the same moment
 * draw the same sky, so one can hand over to another without a seam.
 *
 * The motion is the engine's own star field
 * (components/_3DExhibit-v2/three/modules/starfield): same count, depth,
 * speed and trail, so the world's stars and the page's read as one.
 */
export const STAR_COUNT = 420;
/** Stars start up to this far away, in the units their depth divides by. */
const WARP_Z = 24;
/** Depth travelled a second. */
export const STAR_SPEED = 2.4;
/** Seconds of travel a streak's tail trails behind its head. */
const TRAIL = 0.28;
const MIN_Z = 0.05;

export interface Streak {
    /** Tail and head, in pixels from the middle of the view. */
    tx: number;
    ty: number;
    hx: number;
    hy: number;
    /** Half the streak's width at its head, in pixels. */
    width: number;
    /** 0 to 1: nearer stars burn brighter. */
    glow: number;
    /** 0.5 to 1: three stars in four are white, the rest a shade of blue. */
    lightness: number;
}

/** A number from 0 to 1 that is always the same for the same two inputs. */
export function scatter(a: number, b: number) {
    let h =
        Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 1, 0xc2b2ae35);
    h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
    h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
    return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
}

/**
 * Where star `index` is at `seconds`, in a view `width` by `height`, or
 * null while it is off the view. Each star flies in from its own depth,
 * and starts again from a new place when it has passed.
 */
export function streakAt(
    index: number,
    seconds: number,
    width: number,
    height: number
): Streak | null {
    const depth = 1 + scatter(index, 0) * WARP_Z;
    const flight = (depth - MIN_Z) / STAR_SPEED;
    const clock = seconds + scatter(index, 1) * flight;
    const lap = Math.floor(clock / flight);
    const z = depth - (clock - lap * flight) * STAR_SPEED;
    const x = (scatter(index, lap * 3 + 2) - 0.5) * width;
    const y = (scatter(index, lap * 3 + 3) - 0.5) * height;
    const hx = x / z;
    const hy = y / z;
    if (Math.abs(hx) > width / 2 || Math.abs(hy) > height / 2) return null;
    const tail = z + STAR_SPEED * TRAIL;
    return {
        tx: x / tail,
        ty: y / tail,
        hx,
        hy,
        width: Math.min(2.5, 0.6 + 1.2 / z),
        glow: Math.min(1, 0.25 + 2.5 / z),
        lightness: Math.min(1, 0.5 + scatter(index, lap * 3 + 4) * 2),
    };
}

/** What can be drawn on: a page's canvas or a worker's. */
type Context = Pick<
    CanvasRenderingContext2D,
    | "setTransform"
    | "clearRect"
    | "beginPath"
    | "moveTo"
    | "lineTo"
    | "stroke"
    | "lineWidth"
    | "strokeStyle"
    | "lineCap"
    | "globalCompositeOperation"
>;

/**
 * Draws the stars as they are at `seconds` on a context `pixels` to the
 * CSS pixel. Clears first: nothing of the frame before is kept, so the
 * picture does not depend on how many frames came before it.
 */
export function paintStars(
    context: Context,
    width: number,
    height: number,
    pixels: number,
    seconds: number
) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, width * pixels, height * pixels);
    context.setTransform(
        pixels,
        0,
        0,
        pixels,
        (width * pixels) / 2,
        (height * pixels) / 2
    );
    context.globalCompositeOperation = "lighter";
    context.lineCap = "round";
    let drawn = 0;
    for (let index = 0; index < STAR_COUNT; index++) {
        const star = streakAt(index, seconds, width, height);
        if (!star) continue;
        drawn++;
        const light = Math.round(star.lightness * 100);
        const mx = star.tx + (star.hx - star.tx) * 0.55;
        const my = star.ty + (star.hy - star.ty) * 0.55;
        // The tail, thin and faint, then the head over it.
        context.strokeStyle = `hsla(200, 100%, ${light}%, ${(
            star.glow * 0.3
        ).toFixed(3)})`;
        context.lineWidth = star.width * 0.7;
        context.beginPath();
        context.moveTo(star.tx, star.ty);
        context.lineTo(star.hx, star.hy);
        context.stroke();
        context.strokeStyle = `hsla(200, 100%, ${light}%, ${star.glow.toFixed(
            3
        )})`;
        context.lineWidth = star.width * 2;
        context.beginPath();
        context.moveTo(mx, my);
        context.lineTo(star.hx, star.hy);
        context.stroke();
    }
    return drawn;
}

/** The clock every star field reads, in seconds: the same in every document. */
export function starClock(now = Date.now()) {
    return (now % 86_400_000) / 1000;
}

/** How evenly the frames came, for saying so where load stages are said. */
export interface StarPacing {
    frames: number;
    /** The longest wait between two frames, in milliseconds. */
    worstGap: number;
    /** Waits of more than 50 ms: a visible hitch each. */
    hitches: number;
}

export function pacing() {
    let last = 0;
    const seen: StarPacing = { frames: 0, worstGap: 0, hitches: 0 };
    return {
        frame(now: number) {
            if (last) {
                const gap = now - last;
                if (gap > seen.worstGap) seen.worstGap = Math.round(gap);
                if (gap > 50) seen.hitches++;
            }
            last = now;
            seen.frames++;
        },
        read: (): StarPacing => ({ ...seen }),
    };
}
