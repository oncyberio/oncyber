/**
 * The page's half of game safe areas. The page floats its own interface over
 * a game's frame: the social controls, the party chat the lobby keeps on
 * screen, a phone's notch. Anything marked `data-game-overlay` is measured,
 * turned into four insets (CSS pixels in from each edge of the frame) and
 * sent to the game as `<id>:safe-area`, when the game says hello or ready and
 * whenever the frame or an overlay changes. The game's half is
 * games/runtime/src/safe-area.ts; the rule for games is
 * docs/games/safe-area.md.
 *
 * No imports: `pnpm games:check` loads this file as it is to compute the
 * same insets for its stand-in page (scripts/games/safe-area.mjs).
 */

export interface SafeInsets {
    top: number;
    right: number;
    bottom: number;
    left: number;
}
export type SafeEdge = keyof SafeInsets;
/** An overlay's box relative to the game frame's top-left corner. */
export interface OverlayRect {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
    /** The edge it belongs to, when the nearest one is the wrong guess. */
    edge?: SafeEdge;
}
export interface SafeArea {
    insets: SafeInsets;
    /** The frame's size, so a game can tell which viewport the insets fit. */
    width: number;
    height: number;
}

/**
 * Marks an element that floats over the game. Its value names it in check
 * reports; `data-game-overlay-edge` (top, right, bottom or left) pins the
 * edge it reserves.
 */
export const GAME_OVERLAY_ATTRIBUTE = "data-game-overlay";
export const GAME_OVERLAY_EDGE_ATTRIBUTE = "data-game-overlay-edge";
/** Where the social controls sit unless the catalog moves them. */
export const CONTROLS_PLACEMENT = { top: 84, left: 20 } as const;
/**
 * An overlay that would reserve more than this share of the frame is a
 * panel the visitor opened over the game (an expanded chat), not chrome to
 * lay out around.
 */
export const MAX_INSET_SHARE = 0.4;

const EDGES: SafeEdge[] = ["top", "bottom", "left", "right"];
const NO_INSETS: SafeInsets = { top: 0, right: 0, bottom: 0, left: 0 };

/**
 * Insets that clear every overlay. Each overlay reserves a band along the
 * edge it is closest to (as a share of the frame), on top of the device's
 * own insets. Overlays already inside a reserved band add nothing.
 */
export function computeSafeInsets(
    width: number,
    height: number,
    overlays: OverlayRect[],
    device: SafeInsets = NO_INSETS
): SafeInsets {
    const insets = { ...NO_INSETS };
    for (const edge of EDGES)
        insets[edge] = Number.isFinite(device[edge])
            ? Math.max(0, Math.ceil(device[edge]))
            : 0;
    if (!(width > 0 && height > 0)) return insets;
    const claims = [];
    for (const overlay of overlays) {
        const left = Math.max(0, overlay.x);
        const top = Math.max(0, overlay.y);
        const right = Math.min(width, overlay.x + overlay.width);
        const bottom = Math.min(height, overlay.y + overlay.height);
        if (!(right > left && bottom > top)) continue;
        const pixels = {
            top: bottom,
            bottom: height - top,
            left: right,
            right: width - left,
        };
        const share = (edge: SafeEdge) =>
            pixels[edge] /
            (edge === "top" || edge === "bottom" ? height : width);
        const edge =
            overlay.edge && EDGES.includes(overlay.edge)
                ? overlay.edge
                : EDGES.reduce((a, b) => (share(b) < share(a) ? b : a));
        if (share(edge) > MAX_INSET_SHARE) continue;
        claims.push({
            left,
            top,
            right,
            bottom,
            edge,
            pixels: pixels[edge],
            share: share(edge),
        });
    }
    claims.sort((a, b) => a.share - b.share);
    for (const claim of claims) {
        const covered =
            claim.bottom <= insets.top ||
            claim.top >= height - insets.bottom ||
            claim.right <= insets.left ||
            claim.left >= width - insets.right;
        if (!covered)
            insets[claim.edge] = Math.max(
                insets[claim.edge],
                Math.ceil(claim.pixels)
            );
    }
    return insets;
}

/** The document this page is framed by, when it is ours to read (the lobby). */
function hostDocument(view: Window): Document | null {
    try {
        return view.parent !== view && view.frameElement
            ? view.parent.document
            : null;
    } catch {
        return null;
    }
}

function isShown(element: Element) {
    const check = (element as any).checkVisibility;
    return typeof check === "function"
        ? check.call(element, {
              visibilityProperty: true,
              opacityProperty: true,
          })
        : true;
}

/**
 * Every visible `data-game-overlay` element in this page and, when the page
 * runs inside the lobby, in the lobby's document, relative to the game frame.
 */
export function measureOverlays(frame: HTMLElement): OverlayRect[] {
    const view = frame.ownerDocument.defaultView;
    if (!view) return [];
    const box = frame.getBoundingClientRect();
    const overlays: OverlayRect[] = [];
    const collect = (doc: Document, originX: number, originY: number) => {
        doc.querySelectorAll(`[${GAME_OVERLAY_ATTRIBUTE}]`).forEach(
            (element) => {
                const rect = element.getBoundingClientRect();
                if (!(rect.width > 0 && rect.height > 0) || !isShown(element))
                    return;
                const edge = element.getAttribute(GAME_OVERLAY_EDGE_ATTRIBUTE);
                const overlay: OverlayRect = {
                    id:
                        element.getAttribute(GAME_OVERLAY_ATTRIBUTE) ||
                        element.id ||
                        `overlay-${overlays.length}`,
                    x: Math.round((rect.left - originX) * 10) / 10,
                    y: Math.round((rect.top - originY) * 10) / 10,
                    width: Math.round(rect.width * 10) / 10,
                    height: Math.round(rect.height * 10) / 10,
                };
                if (EDGES.includes(edge as SafeEdge))
                    overlay.edge = edge as SafeEdge;
                // Only what lies over the frame matters.
                if (
                    overlay.x < box.width &&
                    overlay.y < box.height &&
                    overlay.x + overlay.width > 0 &&
                    overlay.y + overlay.height > 0
                )
                    overlays.push(overlay);
            }
        );
    };
    collect(frame.ownerDocument, box.left, box.top);
    const host = hostDocument(view);
    if (host && view.frameElement) {
        // The lobby's pixels are ours shifted by where it put this page.
        const page = view.frameElement.getBoundingClientRect();
        collect(host, page.left + box.left, page.top + box.top);
    }
    return overlays;
}

/** A hidden element whose padding is the device's own safe-area insets. */
function deviceProbe(doc: Document) {
    const probe = doc.createElement("div");
    probe.setAttribute("aria-hidden", "true");
    probe.style.cssText =
        "position:fixed;inset:0;visibility:hidden;pointer-events:none;" +
        "padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) " +
        "env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px)";
    doc.body.appendChild(probe);
    return {
        read(): SafeInsets {
            const style = doc.defaultView?.getComputedStyle(probe);
            const px = (value?: string) => parseFloat(value || "") || 0;
            return {
                top: px(style?.paddingTop),
                right: px(style?.paddingRight),
                bottom: px(style?.paddingBottom),
                left: px(style?.paddingLeft),
            };
        },
        remove: () => probe.remove(),
    };
}

/** The safe area of a game frame as the page lays it out right now. */
export function measureSafeArea(
    frame: HTMLElement,
    device: SafeInsets = NO_INSETS
): SafeArea {
    const box = frame.getBoundingClientRect();
    const width = Math.round(box.width);
    const height = Math.round(box.height);
    return {
        insets: computeSafeInsets(
            width,
            height,
            measureOverlays(frame),
            device
        ),
        width,
        height,
    };
}

/**
 * Keeps a game told of its safe area: measures on the game's `hello` and
 * `ready`, on resize, and whenever an overlay appears, moves or goes, and
 * posts `<game>:safe-area` when the answer changed (always, on hello and
 * ready). Returns the function that stops it.
 */
export function bridgeGameSafeArea(
    frame: HTMLIFrameElement | null,
    game: string
): () => void {
    const doc = frame?.ownerDocument;
    const view = doc?.defaultView;
    if (!frame || !doc || !view) return () => {};
    const probe = deviceProbe(doc);
    const host = hostDocument(view);
    let sent = "";
    let scheduled = 0;
    const watched = new Set<Element>();
    const sizes =
        typeof ResizeObserver === "function"
            ? new ResizeObserver(() => schedule())
            : null;
    const measure = (force = false) => {
        scheduled = 0;
        const area = measureSafeArea(frame, probe.read());
        if (sizes)
            for (const from of host ? [doc, host] : [doc])
                from.querySelectorAll(`[${GAME_OVERLAY_ATTRIBUTE}]`).forEach(
                    (element) => {
                        if (watched.has(element)) return;
                        watched.add(element);
                        sizes.observe(element);
                    }
                );
        const key = JSON.stringify(area);
        if (!force && key === sent) return;
        sent = key;
        // The frame's origin is opaque; the insets are not private.
        frame.contentWindow?.postMessage(
            { type: `${game}:safe-area`, ...area },
            "*"
        );
    };
    const schedule = () => {
        if (!scheduled) scheduled = view.requestAnimationFrame(() => measure());
    };
    const receive = (event: MessageEvent) => {
        if (event.source !== frame.contentWindow) return;
        const type = event.data?.type;
        if (type === `${game}:hello` || type === `${game}:ready`) measure(true);
    };
    const changes =
        typeof MutationObserver === "function"
            ? new MutationObserver(schedule)
            : null;
    for (const from of host ? [doc, host] : [doc])
        changes?.observe(from.body, {
            subtree: true,
            childList: true,
            attributes: true,
        });
    sizes?.observe(frame);
    view.addEventListener("message", receive);
    view.addEventListener("resize", schedule);
    view.visualViewport?.addEventListener("resize", schedule);
    schedule();
    return () => {
        if (scheduled) view.cancelAnimationFrame(scheduled);
        changes?.disconnect();
        sizes?.disconnect();
        view.removeEventListener("message", receive);
        view.removeEventListener("resize", schedule);
        view.visualViewport?.removeEventListener("resize", schedule);
        probe.remove();
    };
}
