/**
 * What the world host will and won't serve (docs/plans/framed-worlds.md).
 * It exists to be framed by the site and holds no session, so:
 *
 * - a page opened there directly goes to the same address on the site;
 * - every page it serves may be framed by the site and by nothing else;
 * - no request reaches the app with cookies, so nothing there is ever
 *   signed in, whatever a browser happens to send.
 *
 * Pure, so the rules can be tested without the middleware around them.
 */
import type { WorldFrame } from "./worldFrame";

export interface WorldHostRequest {
    /** Path and query, as requested. */
    path: string;
    /** `Sec-Fetch-Dest` and `Sec-Fetch-Mode`, when the browser sends them. */
    dest?: string | null;
    mode?: string | null;
}

export type WorldHostAnswer =
    /** Send the visitor to this address on the site. */
    | { redirect: string }
    /** Serve it, without cookies, with this Content-Security-Policy. */
    | { serve: true; policy: string };

export function answerOnWorldHost(
    request: WorldHostRequest,
    frame: WorldFrame
): WorldHostAnswer {
    const isApi = request.path.startsWith("/api/");
    // A person arriving at the world host itself (a pasted link, a
    // bookmark) belongs on the site, where the world is framed.
    if (!isApi && request.dest === "document" && request.mode === "navigate")
        return { redirect: frame.site + request.path };
    return { serve: true, policy: `frame-ancestors ${frame.site}` };
}
