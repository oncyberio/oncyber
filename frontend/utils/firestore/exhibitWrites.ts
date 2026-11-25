/**
 * Fields of a space document that no edit may write: who owns it, its
 * visit count, and its world scripts and their style, which are written
 * only by the checked procedure (pages/api/_v2/worldScripts/save: early
 * access, a schema, a size limit). The legacy update (pages/api/exhibit,
 * UPDATE_EXHIBIT) refuses them in a whole-document write, and in a path
 * update (`pathUpdate` in utils/saveToDb), whose `update` is applied from
 * the document root.
 */
export const PROTECTED_EXHIBIT_FIELDS = [
    "owner",
    "number_of_visits",
    "worldScripts",
    "worldStyle",
    "worldScriptsUpdatedBy",
];

const isOperation = (key: string) => key.startsWith("FIRESTORE_");

/** Does this legacy exhibit update write one of the protected fields? */
export function writesProtectedExhibitField(payload: unknown): boolean {
    if (!payload || typeof payload !== "object") return false;
    const write = payload as Record<string, any>;
    let fields: Record<string, any> | null = null;
    if (write.FIRESTORE_UPDATE_Field) fields = write.update;
    // Without an operation flag the payload itself is the update.
    else if (!Object.keys(write).some(isOperation)) fields = write;
    if (!fields || typeof fields !== "object") return false;
    return Object.keys(fields).some((key) =>
        // Firestore's update() reads "a.b" as a path into field "a".
        PROTECTED_EXHIBIT_FIELDS.includes(key.split(".")[0])
    );
}
