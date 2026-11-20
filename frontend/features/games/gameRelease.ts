/**
 * Where a game's frame loads from. A published game is a hosted release: an
 * immutable set of files outside the repository, named by a hash of their
 * contents. A small pointer says which release each game uses; this file
 * reads pointers and turns one into the frame's address. Games with no
 * pointer still load the build committed under public/games/<id>/.
 *
 * Pointers are written by `pnpm games:publish` and `pnpm games:release`
 * (scripts/games/releases/). See docs/games/releases.md.
 *
 * One reader for everyone: the game page, the kill switch, the lobby's
 * hidden prepare frame and the health reports all take the frame and the
 * release id from `loadGameFrame` (gameReleaseServer.ts): the page in its
 * props, the lobby from /api/games/paused.
 */

export interface GameFrame {
    /** The frame's `src`: the release's `index.html`. */
    src: string;
    /** The release id, when the frame is a hosted release. */
    release: string | null;
    /** hosted: from a pointer. committed: public/games/<id>. draft: the working build. */
    source: "hosted" | "committed" | "draft";
}

export interface HostedRelease {
    release: string;
    base: string;
}

const GAME_ID = /^[a-z0-9][a-z0-9-]{0,62}$/;
const RELEASE_ID = /^[0-9a-f]{16}$/;
/**
 * Where this app serves releases: a local releases folder, and the releases
 * the committed pointer stores on IPFS (pages/api/games/releases).
 */
export const LOCAL_RELEASES_PATH = "/api/games/releases";
/** An IPFS content id: CIDv0 (base58, "Qm…") or CIDv1 in base32 ("b…"). */
const CID = /^(?:Qm[1-9A-HJ-NP-Za-km-z]{44}|b[a-z2-7]{58,120})$/;

/**
 * The gateway folder of a release stored on IPFS through Pinata, or null:
 * the pointer entry's `base`, when the entry says backend `pinata`, its
 * `address` is a CID and the base is an https URL ending in /ipfs/<cid>/
 * with no credentials, query or fragment. A gateway cannot send a release's
 * own Content-Security-Policy, so the page never loads this URL: this app's
 * releases route fetches from it and adds the headers
 * (docs/games/releases.md). scripts/games/releases/storage.mjs holds the
 * same test for the publishing side.
 */
export function pinnedGatewayBase(entry: unknown): string | null {
    const { backend, address, base } = (entry ?? {}) as Record<string, unknown>;
    if (backend !== "pinata" || typeof address !== "string") return null;
    if (!CID.test(address)) return null;
    if (typeof base !== "string" || base.length > 512) return null;
    let url: URL;
    try {
        url = new URL(base);
    } catch {
        return null;
    }
    if (url.protocol !== "https:" || url.href !== base) return null;
    if (url.username || url.password || url.search || url.hash) return null;
    if (!url.pathname.endsWith(`/ipfs/${address}/`)) return null;
    return base;
}

/**
 * Any release a pointer file lists for a game on IPFS, current or not (a
 * rollback target is as servable as the current one): its gateway folder.
 */
export function pinnedRelease(
    pointers: unknown,
    id: string,
    release: string
): HostedRelease | null {
    if (!GAME_ID.test(id) || !RELEASE_ID.test(release)) return null;
    const file = pointers as any;
    if (file?.version !== 1 || typeof file.games !== "object" || !file.games)
        return null;
    const entry = Object.hasOwn(file.games, id) ? file.games[id] : null;
    if (!entry || !Array.isArray(entry.releases)) return null;
    const listed = entry.releases.find(
        (candidate: any) => candidate?.release === release
    );
    const base = pinnedGatewayBase(listed);
    return base ? { release, base } : null;
}

/** The build in public/games/<id>: the fallback, and the draft in development. */
export function committedFrame(id: string): GameFrame {
    return {
        src: `/games/${id}/index.html`,
        release: null,
        source: "committed",
    };
}

/**
 * A base URL the page may load a release from, or null. Either this app's
 * own releases route for exactly this game and release, or an https URL
 * (http on loopback in development). It must end in "/" and carry no
 * credentials, query or fragment.
 */
export function releaseBase(
    id: string,
    release: string,
    base: unknown,
    development = false
): string | null {
    if (typeof base !== "string" || base.length > 512) return null;
    if (base === `${LOCAL_RELEASES_PATH}/${id}/${release}/`) return base;
    let url: URL;
    try {
        url = new URL(base);
    } catch {
        return null;
    }
    const loopback =
        development &&
        url.protocol === "http:" &&
        (url.hostname === "localhost" || url.hostname === "127.0.0.1");
    if (url.protocol !== "https:" && !loopback) return null;
    if (url.username || url.password || url.search || url.hash) return null;
    if (!url.pathname.endsWith("/")) return null;
    return url.href;
}

/**
 * The folder a frame's files load from, ending in "/": the release's base
 * URL, or /games/<id>/ for the committed build. The page reads what travels
 * with the build (its credits) from here, so it describes the build shown.
 */
export function frameBase(id: string, frame?: GameFrame | null): string {
    const src = frame?.src ?? committedFrame(id).src;
    return src.slice(0, src.lastIndexOf("/") + 1);
}

/** The release a pointer file names for a game, if it names a usable one. */
export function pointedRelease(
    pointers: unknown,
    id: string,
    development = false
): HostedRelease | null {
    if (!GAME_ID.test(id)) return null;
    const file = pointers as any;
    if (file?.version !== 1 || typeof file.games !== "object" || !file.games)
        return null;
    const entry = Object.hasOwn(file.games, id) ? file.games[id] : null;
    if (!entry || !Array.isArray(entry.releases)) return null;
    if (typeof entry.current !== "string" || !RELEASE_ID.test(entry.current))
        return null;
    const current = entry.releases.find(
        (candidate: any) => candidate?.release === entry.current
    );
    // A release on IPFS loads through this app's route, never from the
    // gateway: the route sends the headers a gateway cannot.
    if (current?.backend === "pinata")
        return pinnedGatewayBase(current)
            ? {
                  release: entry.current,
                  base: `${LOCAL_RELEASES_PATH}/${id}/${entry.current}/`,
              }
            : null;
    const base = releaseBase(id, entry.current, current?.base, development);
    return base ? { release: entry.current, base } : null;
}

/**
 * The frame for a game: the first pointer file that names a usable release
 * wins, then the committed build. `draft` (development only) skips pointers
 * and shows the working build, which is never a release.
 */
export function resolveGameFrame(
    id: string,
    pointerFiles: unknown[],
    { development = false, draft = false } = {}
): GameFrame {
    if (draft && development) return { ...committedFrame(id), source: "draft" };
    for (const pointers of pointerFiles) {
        const hosted = pointedRelease(pointers, id, development);
        if (hosted)
            return {
                src: `${hosted.base}index.html`,
                release: hosted.release,
                source: "hosted",
            };
    }
    return committedFrame(id);
}
