/**
 * What a framed world may do with its visitor's account, through the page
 * (docs/plans/framed-worlds.md, slice 4). The world holds no session. The
 * in-world interface still needs the account for a few things (my avatars,
 * my settings, am I let in, editing my own space), so those calls, and only
 * those, are made by the page with its own session and the answer handed
 * back. Each entry here is a decision: nothing that reads private account
 * data, moves anything of value, or touches another space is on the list.
 */

/** Procedures, by RPC route, that the page will run for the world. */
export const RELAYED_RPC: Readonly<Record<string, readonly string[]>> =
    Object.freeze({
        // My avatars: listing them, resolving one, its size, adding one.
        // Deleting one is not here.
        "/api/_v2/vrm": [
            "getVrms",
            "getVrm",
            "updateVrm",
            "addOwnedVrm",
            "addUploadedVrm",
            "checkUploadedVrms",
            "getCloudinaryVrm",
        ],
        // Am I let into this world, do I moderate it, and feedback or a
        // report I send from it.
        "/api/_v2/social": ["checkGating", "isMod", "storage"],
    });

export function relayedRpc(route: unknown, method: unknown): boolean {
    return (
        typeof route === "string" &&
        typeof method === "string" &&
        Object.prototype.hasOwnProperty.call(RELAYED_RPC, route) &&
        RELAYED_RPC[route].includes(method)
    );
}

/** A plain request the page will make for the world. */
export type RelayedRoute =
    /** Save my settings: quality, camera, the avatar I chose. */
    | { kind: "settings" }
    /** Save an edit to a space: only ever the one the page opened. */
    | { kind: "space"; id: string };

export function relayedRoute(
    method: unknown,
    address: unknown,
    origin: string
): RelayedRoute | null {
    if (method !== "POST" || typeof address !== "string") return null;
    let url: URL;
    try {
        url = new URL(address, origin);
    } catch {
        return null;
    }
    if (url.origin !== origin) return null;
    if (url.pathname === "/api/user/update" && !url.search)
        return { kind: "settings" };
    const id = url.searchParams.get("id");
    if (
        url.pathname === "/api/exhibit" &&
        url.searchParams.get("type") === "UPDATE_EXHIBIT" &&
        id &&
        [...url.searchParams.keys()].length === 2
    )
        return { kind: "space", id };
    return null;
}

/**
 * The settings a world may save for its visitor. Anything else in the
 * profile (name, picture, wallets, which space is current) is not the
 * world's to change.
 */
const WORLD_SETTINGS = /^settings(\.|$)/;
export function relayedSettings(body: unknown): boolean {
    const payload = (body as { payload?: unknown } | null)?.payload;
    if (!payload || typeof payload !== "object" || Array.isArray(payload))
        return false;
    const keys = Object.keys(payload);
    return keys.length > 0 && keys.every((key) => WORLD_SETTINGS.test(key));
}

/**
 * The edits the in-world editor makes to a space: one of its pieces at a
 * time (an artwork, a portal, a kit part), each with the fields that edit
 * carries (components/_3DExhibit-v2/utils/db.ts). Not here: the path
 * update, which can write any field of a space: who edits it, its gate,
 * its address, its script. Those are changed in the Studio, by the page.
 */
const SPACE_EDITS: Readonly<Record<string, readonly string[]>> = Object.freeze({
    FIRESTORE_ADD_ASSET: ["assetId", "asset"],
    FIRESTORE_REPLACE_ASSET: ["assetId", "asset"],
    FIRESTORE_UPDATE_ASSET: ["assetId", "update"],
    FIRESTORE_DELETE_ASSET: ["assetId"],
    FIRESTORE_UPDATE_PORTAL: ["portalId", "update"],
    FIRESTORE_DELETE_PORTAL: ["portalId"],
    FIRESTORE_RESET_KITBASH: ["data"],
    FIRESTORE_UPDATE_KITBASH: ["id", "update"],
    FIRESTORE_DELETE_KITBASH: ["id"],
});

/** True for a body that is exactly one of those edits and nothing more. */
export function relayedSpaceEdit(body: unknown): boolean {
    const payload = (body as { payload?: unknown } | null)?.payload;
    if (!payload || typeof payload !== "object" || Array.isArray(payload))
        return false;
    const keys = Object.keys(payload);
    const edits = keys.filter((key) => key.startsWith("FIRESTORE_"));
    if (
        edits.length !== 1 ||
        !Object.prototype.hasOwnProperty.call(SPACE_EDITS, edits[0]) ||
        (payload as Record<string, unknown>)[edits[0]] !== true
    )
        return false;
    const fields = SPACE_EDITS[edits[0]];
    return keys.every((key) => key === edits[0] || fields.includes(key));
}

/**
 * The space a relayed call asks about, when it asks about one: am I let
 * in, do I moderate it. Null for a call that names no space.
 */
export function askedSpace(
    route: unknown,
    method: unknown,
    params: unknown
): string | null {
    if (route !== "/api/_v2/social" || !Array.isArray(params)) return null;
    const asked = params[0] as { spaceId?: unknown; slug?: unknown } | null;
    const label =
        method === "checkGating"
            ? asked?.spaceId
            : method === "isMod"
            ? asked?.slug
            : undefined;
    if (method !== "checkGating" && method !== "isMod") return null;
    return typeof label === "string" && label.length <= 200 ? label : "";
}

/** The stand-in the world holds where a session token would be: not one. */
export const PAGE_SESSION = "page";
