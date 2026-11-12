import { firestore } from "firebase-admin";

import { auth, db } from "./firebaseAdmin";

export async function getContentByIds(
    path: string | firestore.CollectionReference,
    fieldFilter: string | firestore.FieldPath,
    ids: string[]
) {
    // don't run if there aren't any ids or a path for the collection
    if (!ids?.length) return [];

    const collectionPath =
        typeof path === "string" ? db.collection(path) : path;

    let batches = [];

    ids = ids.slice();

    while (ids.length) {
        // firestore limits batches to 10
        const batch = ids.splice(0, 10);

        // add the batch request to to a queue
        batches.push(
            collectionPath
                .where(fieldFilter, "in", [...batch])
                .get()
                .then((results) =>
                    results.docs.map((result) => ({
                        id: result.id,
                        ...result.data(),
                    }))
                )
        );
    }

    // after all of the data is fetched, return it
    return Promise.all(batches).then((content) => {
        return content.flat();
    });
}
