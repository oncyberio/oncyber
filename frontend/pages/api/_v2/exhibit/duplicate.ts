import { z } from "zod";
import { proc, NoApi } from "@utils/rpc/server";
import { firestore } from "firebase-admin";
import { db } from "@utils/firebaseAdmin";
import { Failure, Result, Success } from "@utils/js";
import { Experience } from "@uitypes/experience";

import shortid from "shortid";
import { getExhibitById } from "pages/api/exhibit";
import { copyWorldPassword, secretRef } from "@utils/worldPassword/server";

function updateSubcollection(
    batch: firestore.WriteBatch,
    spaceId: string,
    subcollection: string,
    data: any
) {
    //
    Object.keys(data).forEach((key) => {
        //
        const ref = db
            .collection("exhibits")
            .doc(spaceId)
            .collection(subcollection)
            .doc(key);

        batch.set(ref, data[key]);
    });
}

export async function duplicateExhibit(
    userId: string,
    spaceId: string
): Promise<Experience> {
    //
    const exhibit = await getExhibitById(spaceId);

    if (!exhibit) {
        //
        throw new Error("Exhibit not found " + spaceId);
    }

    delete exhibit.id;
    // Do not propagate retired executable content into newly created galleries.
    // This modifies the fetched copy only; the original stored record is intact.
    delete exhibit.games;

    // check if duplicate is made by the owner
    if (exhibit.owner.toLowerCase() !== userId.toLowerCase())
        throw new Error("You don't own this exhibit.");

    exhibit.info.headline = `${
        exhibit?.info?.headline?.split?.(" Duplicate")?.[0] || ""
    } Duplicate-${shortid.generate()}`;

    // we shouldn't duplicate custom link
    exhibit.info.customLink = "";

    exhibit.number_of_visits = 0;

    // @ts-ignore
    exhibit.createdAt = new Date();

    exhibit.editors = [exhibit.owner]; // comment this line in case we want to duplicate the editors too

    let kitbash = exhibit.kitbash;

    delete exhibit.kitbash;

    // we make sure that the editor is indeed an editor of the space
    const editors = await Promise.all(
        exhibit.editors.map(async (editor) => {
            const editorRef = db
                .collection("users")
                .doc(editor)
                .collection("exhibits")
                .doc(spaceId);

            const editorDoc = await editorRef.get();

            if (editorDoc.exists) {
                return {
                    id: editor,
                    editor: editorDoc.data(),
                };
            } else {
                return {};
            }
        })
    );

    // we create a new exhibit with the duplicated data
    const newExhibitRef = db.collection("exhibits").doc();

    const batch = db.batch();

    // The copy keeps the world's password, under its own revision.
    const password = await copyWorldPassword(spaceId);

    if (password) {
        exhibit.gating = { ...exhibit.gating, password: password.password };
        if (password.secret)
            batch.set(secretRef(newExhibitRef.id), password.secret);
    }

    batch.create(newExhibitRef, exhibit);

    // add the exhibit to the editors

    editors.forEach(({ id, editor }) => {
        if (id) {
            const userExhibitRef = db
                .collection("users")
                .doc(id) // userId
                .collection("exhibits")
                .doc(newExhibitRef.id);

            // id of the space needs to be the new one
            editor.id = newExhibitRef.id;

            batch.set(userExhibitRef, editor);
        }
    });

    updateSubcollection(batch, newExhibitRef.id, "kitbash", kitbash);

    await batch.commit();

    exhibit.kitbash = kitbash;

    return {
        ...exhibit,
        id: newExhibitRef.id,
    };
}

export const duplicate = proc({
    auth: true,
    cors: true,

    // schema
    schema: z.object({
        spaceId: z.string().min(1),
    }),

    // handler
    async handler({ spaceId }): Promise<Result<Experience>> {
        //
        try {
            //
            const result = await duplicateExhibit(this.userId, spaceId);

            return Success(result);
            //
        } catch (err) {
            //
            console.error(err);

            return Failure(err.message);
        }
    },
});

/**
 * Not found, All apis are accessible from index file
 */
export default NoApi;
