import { z } from "zod";

import { proc, NoApi } from "@utils/rpc/server";

import { db } from "@utils/firebaseAdmin";
import { generateHash } from "./utils";
import { saveUpload } from "@api/anyUpload/setUploadedAssets";
import { patchUploadIndex } from "@api/anyUpload/uploadIndex";
import { secureGatingPatches, secretRef } from "@utils/worldPassword/server";

async function saveExhibit(
    batch: FirebaseFirestore.WriteBatch,
    userId: string,
    parsedExhibit: any
) {
    //
    const { id, version, kitbash, mock, ...exhibit } = parsedExhibit;

    const exhibitRef = db.collection("exhibits").doc();

    // A password set while anonymous is stored hashed, as any other.
    if (exhibit.gating?.password) {
        const { patches, secretWrite } = await secureGatingPatches(
            [{ op: "add", path: ["gating"], value: exhibit.gating }],
            null
        );
        exhibit.gating = patches[0].value;
        if (secretWrite?.type === "set")
            batch.set(secretRef(exhibitRef.id), secretWrite.secret);
    }

    Object.values(exhibit.artworks).forEach((artwork: any) => {
        exhibit.artworks[artwork.data.id].addedBy = userId.toLowerCase();
    });

    const userRef = db.collection("users").doc(userId);

    const userExhibitRef = userRef.collection("exhibits").doc(exhibitRef.id);

    batch.set(exhibitRef, {
        ...exhibit,
        owner: userId.toLowerCase(),
        editors: [userId.toLowerCase()],
        createdAt: new Date(),
        number_of_visits: 0,
    });

    batch.update(userRef, {
        currentExhibitId: exhibitRef.id,
    });

    batch.set(userExhibitRef, {
        id: exhibitRef.id,
    });

    const kitbashRef = db
        .collection("exhibits")
        .doc(exhibitRef.id)
        .collection("kitbash");

    Object.keys(kitbash).map(async (id) => {
        //
        const c = kitbash[id];
        batch.set(kitbashRef.doc(id), c);
    });
}

function saveUploads(
    batch: FirebaseFirestore.WriteBatch,
    userId: string,
    uploads: any
) {
    //
    const entries: Record<string, any> = {};

    uploads.forEach((upload) => {
        //
        entries[upload.hash] = saveUpload(batch, userId, upload);
    });

    return entries;
}

export const initAnon = proc({
    cors: true,
    auth: true,

    schema: z.object({
        sExhibit: z.string(),
        exhibit: z.any(),
        uploads: z.any(),
    }),

    async handler({ sExhibit, uploads, exhibit }) {
        try {
            if (!sExhibit) return { success: false };

            const userId = this.userId;

            const fHash = await generateHash(sExhibit);

            const prevHash = this.req?.cookies["_edit_hash"];

            if (fHash !== prevHash) {
                return {
                    success: false,
                    message: "Failed to init anon user.",
                };
            }

            const batch = db.batch();

            await saveExhibit(batch, userId, exhibit);

            const uploadEntries = saveUploads(batch, userId, uploads);

            await batch.commit();

            if (Object.keys(uploadEntries).length) {
                await patchUploadIndex(userId, uploadEntries);
            }

            return {
                success: true,
            };
        } catch (err) {
            //
            console.error(err);

            return {
                success: false,
                message: err.toString(),
            };
        }
    },
});

/**
 * Not found, All apis are accessible from index file
 */
export default NoApi;
