/**
 * Screen space a game can use. The Oncyber page floats its own interface over
 * the game's frame (social controls, the party chat, a device's notch), so it
 * measures those and sends the game safe-area insets: how far in from each
 * edge, in CSS pixels, the game's HUD and menus must stay.
 *
 *     page -> game   { type: "oncyber:game:safe-area", insets, width, height }
 *                    ("<id>:safe-area" to a game from before the contract)
 *     any  -> game   { type: "oncyber:hud-request", request }
 *     game -> asker  { type: "oncyber:hud-report", request, hud, insets, width, height }
 *
 * `watchSafeArea` keeps the insets and writes them to CSS variables;
 * `hudRects` and `answerHudRequests` let `pnpm games:check` see where the HUD
 * is. Its one import is the contract's message prefix (pure data), so the
 * check script and the tests load this file as it is.
 * See docs/games/safe-area.md.
 */
import { GAME_MESSAGE_PREFIX, legacyMessagePrefix } from "./contract.ts";

export interface SafeInsets {
    top: number;
    right: number;
    bottom: number;
    left: number;
}
export interface Rect {
    x: number;
    y: number;
    width: number;
    height: number;
}
/** One HUD or menu element, in CSS pixels of the game's own viewport. */
export interface HudRect extends Rect {
    id: string;
}
export interface HudReport {
    hud: HudRect[];
    insets: SafeInsets;
    width: number;
    height: number;
}

export const SAFE_AREA_KIND = "safe-area";
/** The same message without a game id, for a game's own nested UI frame. */
export const SAFE_AREA_MESSAGE = "oncyber:safe-area";
export const HUD_REQUEST = "oncyber:hud-request";
export const HUD_REPORT = "oncyber:hud-report";
export const SAFE_AREA_VARIABLES = {
    top: "--oncyber-safe-top",
    right: "--oncyber-safe-right",
    bottom: "--oncyber-safe-bottom",
    left: "--oncyber-safe-left",
} as const;
export const NO_INSETS: SafeInsets = Object.freeze({
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
});
const EDGES = ["top", "right", "bottom", "left"] as const;
const MAX_INSET = 4096;
const MAX_HUD_RECTS = 64;

/** Insets from a message, or null when malformed. Whole pixels, never negative. */
export function readSafeInsets(value: unknown): SafeInsets | null {
    if (!value || typeof value !== "object") return null;
    const out = { top: 0, right: 0, bottom: 0, left: 0 };
    for (const edge of EDGES) {
        const n = (value as Record<string, unknown>)[edge];
        if (typeof n !== "number" || !Number.isFinite(n)) return null;
        out[edge] = Math.min(MAX_INSET, Math.max(0, Math.ceil(n)));
    }
    return out;
}

export const sameInsets = (a: SafeInsets, b: SafeInsets) =>
    EDGES.every((edge) => a[edge] === b[edge]);

/** Writes `--oncyber-safe-top` (and right, bottom, left) on an element, in px. */
export function applySafeInsets(
    element: { style: { setProperty(name: string, value: string): void } },
    insets: SafeInsets
) {
    for (const edge of EDGES)
        element.style.setProperty(
            SAFE_AREA_VARIABLES[edge],
            `${insets[edge]}px`
        );
}

interface FrameLike {
    contentWindow: {
        postMessage(message: unknown, target: string): void;
    } | null;
    addEventListener?(type: "load", listener: () => void): void;
    removeEventListener?(type: "load", listener: () => void): void;
}
interface WindowLike {
    parent: unknown;
    innerWidth: number;
    innerHeight: number;
    document?: {
        documentElement: {
            style: { setProperty(name: string, value: string): void };
        };
    };
    addEventListener(type: "message", listener: (event: any) => void): void;
    removeEventListener(type: "message", listener: (event: any) => void): void;
}

/**
 * Follows the page's safe-area insets. Call it once, as early as the game
 * runs: it sets the four CSS variables on the document's root element (0px
 * until the page speaks, and when the game runs on its own) and calls
 * `onChange` whenever they change.
 *
 * The page says "oncyber:game:safe-area" (docs/games/contract.md). `game` is
 * for a game from before the contract only: its id, so "<id>:safe-area" is
 * heard too. `relay` lists the game's own UI frames: each is sent the
 * insets as "oncyber:safe-area", and calls this function without a `game`.
 */
export function watchSafeArea(
    options: {
        game?: string;
        onChange?(insets: SafeInsets): void;
        relay?: FrameLike[];
        window?: WindowLike;
    } = {}
) {
    const view = options.window ?? (globalThis as unknown as WindowLike);
    const root = view.document?.documentElement;
    const types = new Set([
        SAFE_AREA_MESSAGE,
        GAME_MESSAGE_PREFIX + SAFE_AREA_KIND,
        ...(options.game
            ? [legacyMessagePrefix(options.game) + SAFE_AREA_KIND]
            : []),
    ]);
    let insets: SafeInsets = NO_INSETS;
    if (root) applySafeInsets(root, insets);
    const forward = () => {
        for (const frame of options.relay ?? [])
            frame.contentWindow?.postMessage(
                { type: SAFE_AREA_MESSAGE, insets },
                "*"
            );
    };
    const receive = (event: { source: unknown; data: any }) => {
        if (
            event.source !== view.parent ||
            view.parent === view ||
            !types.has(event.data?.type)
        )
            return;
        const next = readSafeInsets(event.data.insets);
        if (!next) return;
        const changed = !sameInsets(next, insets);
        insets = next;
        if (changed && root) applySafeInsets(root, insets);
        // A UI frame that loaded late still needs them, changed or not.
        forward();
        if (changed) options.onChange?.(insets);
    };
    view.addEventListener("message", receive);
    for (const frame of options.relay ?? [])
        frame.addEventListener?.("load", forward);
    return {
        get insets() {
            return insets;
        },
        dispose() {
            view.removeEventListener("message", receive);
            for (const frame of options.relay ?? [])
                frame.removeEventListener?.("load", forward);
        },
    };
}

/**
 * Where the HUD is: one rectangle per element matching `selector` that is
 * laid out right now, named by its `data-hud` value or its id. Mark what a
 * player reads or presses (score, buttons, menu cards), not full-screen
 * backdrops. Return the list as `hud` from `inspect()`.
 */
export function hudRects(
    root: { querySelectorAll(selector: string): ArrayLike<any> } = (
        globalThis as any
    ).document,
    selector = "[data-hud]"
): HudRect[] {
    const out: HudRect[] = [];
    const elements = Array.from(root.querySelectorAll(selector));
    for (let i = 0; i < elements.length && out.length < MAX_HUD_RECTS; i++) {
        const element = elements[i];
        const box = element.getBoundingClientRect();
        if (!(box.width > 0 && box.height > 0)) continue;
        const round = (n: number) => Math.round(n * 10) / 10;
        out.push({
            id: String(
                element.getAttribute?.("data-hud") || element.id || `hud-${i}`
            ).slice(0, 64),
            x: round(box.left),
            y: round(box.top),
            width: round(box.width),
            height: round(box.height),
        });
    }
    return out;
}

/** HUD rectangles out of an `inspect()` result; malformed entries are dropped. */
export function readHudRects(value: unknown): HudRect[] {
    if (!Array.isArray(value)) return [];
    const out: HudRect[] = [];
    for (const item of value.slice(0, MAX_HUD_RECTS)) {
        if (!item || typeof item !== "object") continue;
        const { id, x, y, width, height } = item as Record<string, unknown>;
        if (
            ![x, y, width, height].every(
                (n) => typeof n === "number" && Number.isFinite(n)
            )
        )
            continue;
        if (!((width as number) > 0 && (height as number) > 0)) continue;
        out.push({
            id:
                typeof id === "string" && id
                    ? id.slice(0, 64)
                    : `hud-${out.length}`,
            x: x as number,
            y: y as number,
            width: width as number,
            height: height as number,
        });
    }
    return out;
}

/**
 * Answers the check's "where is your HUD?" with `inspect().hud`, the insets
 * the game holds and its viewport size. `inspect` is the game's own
 * `inspect()` (or the session's); it may be async, for a HUD that lives in a
 * UI frame (see `requestHud`).
 */
export function answerHudRequests(
    inspect: () => { hud?: unknown } | Promise<{ hud?: unknown }>,
    options: { insets?: () => SafeInsets; window?: WindowLike } = {}
) {
    const view = options.window ?? (globalThis as unknown as WindowLike);
    const receive = (event: { source: any; data: any }) => {
        if (
            event.source !== view.parent ||
            view.parent === view ||
            event.data?.type !== HUD_REQUEST
        )
            return;
        const request = event.data.request;
        void Promise.resolve()
            .then(inspect)
            .then(
                (state) => readHudRects(state?.hud),
                () => [] as HudRect[]
            )
            .then((hud) =>
                event.source.postMessage(
                    {
                        type: HUD_REPORT,
                        request,
                        hud,
                        insets: options.insets?.() ?? NO_INSETS,
                        width: view.innerWidth,
                        height: view.innerHeight,
                    },
                    "*"
                )
            );
    };
    view.addEventListener("message", receive);
    return () => view.removeEventListener("message", receive);
}

/**
 * Asks a frame (a game's UI frame) for its HUD rectangles. Resolves to an
 * empty list when it doesn't answer in time. The frame must fill this
 * window, so its pixels are this window's pixels.
 */
export function requestHud(
    frame: FrameLike,
    options: { timeoutMs?: number; window?: WindowLike } = {}
): Promise<HudRect[]> {
    const view = options.window ?? (globalThis as unknown as WindowLike);
    const request = `${Date.now().toString(36)}-${Math.random()
        .toString(36)
        .slice(2)}`;
    return new Promise((resolve) => {
        const finish = (hud: HudRect[]) => {
            clearTimeout(timer);
            view.removeEventListener("message", receive);
            resolve(hud);
        };
        const receive = (event: { source: unknown; data: any }) => {
            if (
                event.source !== frame.contentWindow ||
                event.data?.type !== HUD_REPORT ||
                event.data.request !== request
            )
                return;
            finish(readHudRects(event.data.hud));
        };
        const timer = setTimeout(() => finish([]), options.timeoutMs ?? 1000);
        view.addEventListener("message", receive);
        if (frame.contentWindow)
            frame.contentWindow.postMessage(
                { type: HUD_REQUEST, request },
                "*"
            );
        else finish([]);
    });
}

export interface HudOverlap {
    hud: string;
    overlay: string;
    /** Square CSS pixels the two share. */
    area: number;
}
/**
 * Every HUD rectangle that sits under a page overlay. Touching edges and
 * slivers under `tolerance` px (rounding) don't count.
 */
export function findHudOverlaps(
    hud: HudRect[],
    overlays: Array<Rect & { id?: string }>,
    tolerance = 1
): HudOverlap[] {
    const out: HudOverlap[] = [];
    for (const item of hud)
        for (let i = 0; i < overlays.length; i++) {
            const overlay = overlays[i];
            const w =
                Math.min(item.x + item.width, overlay.x + overlay.width) -
                Math.max(item.x, overlay.x);
            const h =
                Math.min(item.y + item.height, overlay.y + overlay.height) -
                Math.max(item.y, overlay.y);
            if (w > tolerance && h > tolerance)
                out.push({
                    hud: item.id,
                    overlay: overlay.id ?? `overlay-${i}`,
                    area: Math.round(w * h),
                });
        }
    return out;
}

/** HUD rectangles that reach outside the safe area of a `width` x `height` viewport. */
export function outsideSafeArea(
    hud: HudRect[],
    insets: SafeInsets,
    width: number,
    height: number,
    tolerance = 1
): string[] {
    return hud
        .filter(
            (r) =>
                r.x < insets.left - tolerance ||
                r.y < insets.top - tolerance ||
                r.x + r.width > width - insets.right + tolerance ||
                r.y + r.height > height - insets.bottom + tolerance
        )
        .map((r) => r.id);
}
