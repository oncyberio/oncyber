import type { Experience } from "@uitypes/experience";
import { db } from "../firebaseAdmin";

type ExhibitAccess = Pick<Experience, "id" | "editors" | "gating">;
const ACCESS_FIELDS = ["editors", "gating"];
// `gating` is the stored value: it can hold a world's password (older
// documents). Server only; never send it to a client as it is.
const accessFields = (
    id: string,
    data: Partial<ExhibitAccess>
): ExhibitAccess => ({
    id,
    editors: data.editors,
    gating: data.gating,
});

/** Read live access fields without hydrating or caching gallery content. */
export async function getExhibitAccessByCustomLink(
    customLink: string
): Promise<ExhibitAccess | null> {
    if (customLink.startsWith("s@")) {
        const id = customLink.slice(2);
        const [document] = await db.getAll(db.collection("exhibits").doc(id), {
            fieldMask: ACCESS_FIELDS,
        });
        return document.exists ? accessFields(id, document.data()) : null;
    }

    const result = await db
        .collection("exhibits")
        .where("info.customLink", "==", customLink)
        .select(...ACCESS_FIELDS)
        .limit(1)
        .get();
    return result.empty
        ? null
        : accessFields(result.docs[0].id, result.docs[0].data());
}
