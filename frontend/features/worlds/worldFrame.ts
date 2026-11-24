/**
 * Native worlds in a frame (docs/plans/framed-worlds.md): which host is the
 * page and which is the world.
 *
 * The same app answers on two hosts. On the site's host a space is the
 * page: account, header, prompts, and a frame. On the world host the same
 * address is the world itself, with no session, drawn inside that frame.
 * `NEXT_PUBLIC_WORLD_ORIGIN` names the world host; unset, or not a second
 * host, worlds run in the page as they always have.
 *
 * No imports: the middleware, the server and the browser all read this.
 */
export interface WorldFrame {
    /** The site's origin: the only page that may frame a world. */
    site: string;
    /** The origin worlds are served from. */
    world: string;
}

/** Which side of the frame a request or a document is on. */
export type WorldFrameRole = "page" | "world";

function origin(value: string | undefined): URL | null {
    if (!value) return null;
    try {
        const url = new URL(value);
        return /^https?:$/.test(url.protocol) && url.origin === value
            ? url
            : null;
    } catch {
        return null;
    }
}

/**
 * The two origins, or null when worlds are not framed. They must be two
 * different hosts: a world on the site's own host would share its cookies.
 */
export function readWorldFrame(
    world: string | undefined,
    site: string | undefined
): WorldFrame | null {
    const worldUrl = origin(world);
    const siteUrl = origin(site);
    if (!worldUrl || !siteUrl || worldUrl.hostname === siteUrl.hostname)
        return null;
    return { site: siteUrl.origin, world: worldUrl.origin };
}

export const WORLD_FRAME = readWorldFrame(
    process.env.NEXT_PUBLIC_WORLD_ORIGIN,
    process.env.NEXT_PUBLIC_SITE_ORIGIN
);

/**
 * The role of the host a request came to. Another host of the deployment
 * (a preview address, say) is neither: worlds there run in the page.
 */
export function worldFrameRole(
    host: string | null | undefined,
    frame: WorldFrame | null = WORLD_FRAME
): WorldFrameRole | null {
    if (!frame || !host) return null;
    const name = host.toLowerCase();
    if (name === new URL(frame.world).host) return "world";
    if (name === new URL(frame.site).host) return "page";
    return null;
}

/** The same path and query on the world host: what the page frames. */
export function worldFrameUrl(path: string, frame: WorldFrame): string {
    return frame.world + (path.startsWith("/") ? path : `/${path}`);
}

/**
 * The frame's sandbox. The world keeps its own origin (it is another
 * site, so that gives it storage of its own and nothing of the page's) and
 * may lock the pointer. It may not open windows, leave the frame, or
 * navigate the page: links and travel go through the page.
 */
export const WORLD_SANDBOX =
    "allow-scripts allow-same-origin allow-pointer-lock";

/** What the browser lets a world do; anything unlisted is off. */
export const WORLD_PERMISSIONS =
    "autoplay; fullscreen; gamepad; xr-spatial-tracking";
