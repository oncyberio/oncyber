/**
 * Fields of a space document that no edit may write: who owns it and its
 * visit count. The legacy update (pages/api/exhibit, UPDATE_EXHIBIT) refuses
 * them in a whole-document write, and in a path update (`pathUpdate` in
 * utils/saveToDb), whose `update` is applied from the document root.
 */
export const PROTECTED_EXHIBIT_FIELDS = ["owner", "number_of_visits"];

const isOperation = (key: string) => key.startsWith("FIRESTORE_");

/** Does this legacy exhibit update write owner or number_of_visits? */
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
