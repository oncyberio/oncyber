/**
 * Where a game's frame loads from. A published game is a hosted release: an
 * immutable set of files outside the repository, named by a hash of their
 * contents. A small pointer says which release each game uses; this file
 * reads pointers and turns one into the frame's address. Games with no
 * pointer still load the build committed under public/games/<id>/.
 *
 * Pointers are written by `pnpm games:publish` and `pnpm games:release`
 * (scripts/games/releases/). See docs/games/releases.md.
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
/** Where this app serves a local releases folder. */
export const LOCAL_RELEASES_PATH = "/api/games/releases";

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
