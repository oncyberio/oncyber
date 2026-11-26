/**
 * Camera motion blur: settings and the per-frame decisions that need no GPU.
 *
 * The blur is off unless the page asks for it with `?motionblur=1` (any of
 * 1, on, true, yes). `?motionblur=0` turns it off. `?mbshutter=` changes the
 * shutter (0 to 1: how much of a 30 fps frame the virtual shutter stays
 * open, whatever the real frame rate; the default 1, an exposure of 1/30 s,
 * is the strong blur of console games). `?mbsamples=` changes the number of
 * taps per pixel (4 to 32, default 16).
 */

export const DEFAULT_SHUTTER = 1;

export const DEFAULT_SAMPLES = 16;

/**
 * Longest blur, as a fraction of the drawing buffer's height. It is also
 * the tile size of the reconstruction filter, so it bounds the cost of the
 * tile pass. 6% is about 65 px on a 1080 px tall view.
 */
export const MAX_BLUR_FRACTION = 0.06;

/** A camera jump longer than this (scene units, metres) is a cut: no blur. */
export const CUT_DISTANCE = 3;

/** A camera turn larger than this in one frame (radians) is a cut. */
export const CUT_ANGLE = (50 * Math.PI) / 180;

/** Frames further apart than this (seconds) are not blended. */
export const MAX_FRAME_GAP = 0.25;

export interface MotionBlurOptions {
    enabled: boolean;
    shutter: number;
    samples: number;
}

const ON = new Set(["1", "on", "true", "yes"]);

function numberIn(
    value: string | null,
    fallback: number,
    min: number,
    max: number
): number {
    if (value === null || value === "") return fallback;
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(max, Math.max(min, parsed));
}

/** Reads the options from a query string such as `location.search`. */
export function motionBlurOptions(search: string = ""): MotionBlurOptions {
    const params = new URLSearchParams(search);
    const flag = params.get("motionblur");
    return {
        enabled: flag !== null && ON.has(flag.trim().toLowerCase()),
        shutter: numberIn(params.get("mbshutter"), DEFAULT_SHUTTER, 0, 1),
        samples: Math.round(
            numberIn(params.get("mbsamples"), DEFAULT_SAMPLES, 4, 32)
        ),
    };
}

/** The options for this page, or "off" outside a browser. */
export function pageMotionBlurOptions(): MotionBlurOptions {
    if (typeof window === "undefined")
        return {
            enabled: false,
            shutter: DEFAULT_SHUTTER,
            samples: DEFAULT_SAMPLES,
        };
    return motionBlurOptions(window.location.search);
}

/** Tile edge in drawing-buffer pixels for a buffer `height` pixels tall. */
export function tileSize(height: number): number {
    return Math.max(4, Math.ceil(height * MAX_BLUR_FRACTION));
}

type Vec3 = { x: number; y: number; z: number };
type Quat = { x: number; y: number; z: number; w: number };

/** Angle between two unit quaternions, in radians. */
export function quaternionAngle(a: Quat, b: Quat): number {
    const dot = Math.abs(a.x * b.x + a.y * b.y + a.z * b.z + a.w * b.w);
    return 2 * Math.acos(Math.min(1, dot));
}

/**
 * Whether the step between the previous frame's camera and this one is a
 * cut (a teleport, a travel, a mode switch, a long pause) rather than motion.
 * A cut is drawn sharp, and the next frame blurs from it.
 */
export function isCameraCut(
    previous: { position: Vec3; quaternion: Quat; time: number },
    current: { position: Vec3; quaternion: Quat; time: number }
): boolean {
    const gap = current.time - previous.time;
    if (!(gap > 0) || gap > MAX_FRAME_GAP) return true;
    const dx = current.position.x - previous.position.x;
    const dy = current.position.y - previous.position.y;
    const dz = current.position.z - previous.position.z;
    if (dx * dx + dy * dy + dz * dz > CUT_DISTANCE * CUT_DISTANCE) return true;
    return quaternionAngle(previous.quaternion, current.quaternion) > CUT_ANGLE;
}
