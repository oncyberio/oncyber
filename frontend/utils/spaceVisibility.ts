/**
 * Is a space open to everyone: not a mock, not deleted, not private,
 * unlisted or a draft? Discovery search and the sitemap list only these.
 */
export function isPublicSpace(data: any): boolean {
    return !(
        !data ||
        data.mock ||
        data.deleted ||
        data.isPublic === false ||
        data.published === false ||
        data.info?.private ||
        ["private", "unlisted", "draft"].includes(
            data.visibility || data.info?.visibility
        )
    );
}

/** The fields isPublicSpace reads, for Firestore `select()`. */
export const PUBLIC_SPACE_FIELDS = [
    "mock",
    "deleted",
    "isPublic",
    "published",
    "visibility",
    "info.private",
    "info.visibility",
];
