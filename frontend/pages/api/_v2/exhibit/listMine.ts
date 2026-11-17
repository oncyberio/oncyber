import { z } from "zod";
import { proc, NoApi } from "@utils/rpc/server";
import { db } from "@utils/firebaseAdmin";

/** What a card for one of your spaces needs, and nothing heavier. */
export interface SpaceSummary {
    id: string;
    createdAt: string;
    invited: boolean;
    info: {
        headline?: string;
        heroImg?: string;
        cHeroImg?: string;
        room?: string;
        customLink?: string;
        description?: string;
    };
}

// Only these leave Firestore: a space's artworks and kitbash can run to
// megabytes, and a list of spaces shows none of them.
const SUMMARY_FIELDS = [
    "info.headline",
    "info.heroImg",
    "info.cHeroImg",
    "info.room",
    "info.customLink",
    "info.description",
    "createdAt",
];

export async function listSpaceSummaries(userId: string) {
    const [links, account] = await Promise.all([
        db.collection("users").doc(userId).collection("exhibits").get(),
        db.getAll(db.collection("users").doc(userId), {
            fieldMask: ["currentExhibitId"],
        }),
    ]);
    const docs = links.empty
        ? []
        : await db.getAll(
              ...links.docs.map((link) =>
                  db.collection("exhibits").doc(link.id)
              ),
              { fieldMask: SUMMARY_FIELDS }
          );
    const spaces: SpaceSummary[] = [];
    docs.forEach((doc, index) => {
        if (!doc.exists) return;
        const data = doc.data() || {};
        spaces.push({
            id: doc.id,
            createdAt: data.createdAt?.toDate?.()?.toISOString?.() || "",
            invited: !!links.docs[index].data()?.invited,
            info: data.info || {},
        });
    });
    return {
        spaces,
        currentId: (account[0]?.data()?.currentExhibitId as string) || "",
    };
}

/**
 * The signed-in account's spaces, owned and shared, as light summaries for
 * lists. `GET_USERS_EXHIBITS` returns whole spaces, which Studio's own menu
 * needs and a list of cards does not.
 */
export const listMine = proc({
    auth: true,
    cors: true,
    schema: z.object({}),
    async handler() {
        return listSpaceSummaries(this.userId);
    },
});

/**
 * Not found, All apis are accessible from index file
 */
export default NoApi;
