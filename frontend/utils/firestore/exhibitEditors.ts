import { db } from "../firebaseAdmin";

/**
 * Owner or editor of a space, ids compared case-insensitively: the check the
 * space-writing endpoints make (assertExhibitEditor in
 * pages/api/_v2/asset/assetOperations, isEditorOrOwner in _v2/exhibit/get).
 */
export function isExhibitOwnerOrEditor(
    exhibit: { owner?: string; editors?: string[] } | null,
    userId: unknown
): boolean {
    if (!exhibit || typeof userId !== "string" || !userId) return false;
    const id = userId.toLowerCase();
    if (exhibit.owner?.toLowerCase?.() === id) return true;
    return (exhibit.editors || []).some((e) => e?.toLowerCase?.() === id);
}

/** Reads the live space document and asks isExhibitOwnerOrEditor. */
export async function canEditExhibit(
    exhibitId: string,
    userId: unknown
): Promise<boolean> {
    if (!exhibitId) return false;
    const doc = await db.collection("exhibits").doc(exhibitId).get();
    return doc.exists && isExhibitOwnerOrEditor(doc.data(), userId);
}
