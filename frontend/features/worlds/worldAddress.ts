/**
 * The address a world's frame is loaded at: the page's own address on the
 * world host (docs/plans/framed-worlds.md).
 *
 * Not all of the page's address goes along. A page can be opened with
 * something in its address that is for the page alone: the one-time code
 * of an emailed sign-in link, an invitation, a token. A world reads its own
 * address, so those stay behind.
 */
import { isLobbyDestination } from "@utils/lobbyDestinationBridge";
import { readPreviewOption } from "@features/lobby/lobbyPreviewOptions";
import { worldFrameUrl, type WorldFrame } from "./worldFrame";

// By what a name ends in: `oobCode`, `apiKey`, `token`, `inviteId`...
const PRIVATE_PARAM =
    /(code|key|token|secret|password|signature|sig|auth|session|jwt|invite|inviteid)$/i;

/** The page's path and query as a world may have them. */
export function worldPath(path: string): string {
    const url = new URL(path, "https://oncyber.invalid");
    for (const name of [...url.searchParams.keys()])
        if (PRIVATE_PARAM.test(name)) url.searchParams.delete(name);
    // A fragment made of names and values is somebody's answer to the page
    // (a sign-in coming back); a plain one is only a place on it.
    const hash = /[=&]/.test(url.hash) ? "" : url.hash;
    return url.pathname + url.search + hash;
}

/**
 * The world's address for this page's. Inside the lobby, the travel options
 * the lobby was opened with go along: the world cannot read them from the
 * lobby's address as an unframed space does.
 */
export function worldSrc(path: string, frame: WorldFrame) {
    const url = new URL(worldFrameUrl(worldPath(path), frame));
    if (isLobbyDestination())
        for (const name of ["travel", "reveal", "departure"]) {
            const value = readPreviewOption(name);
            if (value && !url.searchParams.has(name))
                url.searchParams.set(name, value);
        }
    return url.href;
}
