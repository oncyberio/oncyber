/** Legacy exhibit.games is reserved and inert; published games run in the content host. */
export const GALLERY_SCRIPTS_RETIRED = "Gallery custom scripts have been retired";

export function isLegacyGalleryScriptPath(path: readonly string[]) {
    // Dotted strings are accepted by the old Firestore update API.
    return path[0] === "games" || path[0]?.startsWith("games.") === true;
}

export function hasLegacyGalleryScriptWrite(payload: unknown): boolean {
    if (!payload || typeof payload !== "object") return false;
    return Object.keys(payload).some((key) => isLegacyGalleryScriptPath([key]));
}
