import { firestore } from "firebase-admin";
import { auth } from "../../utils/middlewares/authMiddleware";
import { db } from "../../utils/firebaseAdmin";
import { getContentByIds } from "../../utils/getContentByIds";
import { Stylekit } from "../../@types/experience";
import { corsMiddleware } from "../../utils/middlewares/corsMiddleware";

export const geTStylekitById = async (id: string): Promise<Stylekit> => {
    //
    const doc = await db.collection("stylekits").doc(id).get();

    if (!doc.exists) return null;

    return {
        id: doc.id,
        ...doc.data(),
    } as Stylekit;
};

export const getStylekitByRoom = async (room: string): Promise<Stylekit> => {
    //
    const query = await db
        .collection("stylekits")
        .where("info.room", "==", room)
        .limit(1)
        .get();

    if (query.empty) {
        return null;
    }

    const doc = query.docs[0];

    return { id: doc.id, ...doc.data() } as Stylekit;
};

function isPrimitive(v: any) {
    let type = typeof v;
    return (
        v == null ||
        type === "string" ||
        type === "number" ||
        type === "boolean" ||
        Array.isArray(v)
    );
}

function deconstructUpdates(object: object, currentPath = [], args = []) {
    for (let key in object) {
        let path = currentPath.concat(key);
        let value = object[key];
        if (value == null) {
            args.push(new firestore.FieldPath(...path), null);
        } else if (value.FIRESTORE_SET_Field) {
            args.push(new firestore.FieldPath(...path), value.value);
        } else if (value.FIRESTORE_DELETE_Field) {
            args.push(
                new firestore.FieldPath(...path),
                firestore.FieldValue.delete()
            );
        } else if (isPrimitive(value)) {
            args.push(new firestore.FieldPath(...path), value);
        } else {
            deconstructUpdates(value, path, args);
        }
    }
    return args;
}

const isEditor = (userId) => (exhibit, payload) => {
    let result = exhibit.editors?.some(
        (id) => id.toLowerCase() == userId?.toLowerCase()
    );

    // You can't update room, but we always send room with payloads
    // if (payload.info.room) {
    //     return {
    //         success: false,
    //         error: "Get out of here",
    //     };
    // }

    return result
        ? { success: true }
        : {
              success: false,
              error: "Get out of here",
          };
};

export const updateStylekit = async (
    id,
    origPayload,
    userId,
    precondition = isEditor(userId)
) => {
    return db.runTransaction(async (transaction) => {
        let payload = origPayload;

        const ref = db.collection("stylekits").doc(id);

        const doc = await transaction.get(ref);

        if (!doc.exists) return;

        const stylekit = doc.data() as Stylekit;

        let testExhibit = stylekit;

        let preResult = precondition(testExhibit, payload);

        if (!preResult.success) return preResult;

        let lastUpdatedAt = new firestore.FieldPath("lastUpdatedAt");

        let lastContentUpdatedAt = new firestore.FieldPath(
            "lastContentUpdatedAt"
        );

        let now = Date.now();

        if (payload.FIRESTORE_RESET_KITBASH) {
            //
            let path = new firestore.FieldPath("kitbash");

            let args = [path, payload.data];

            args.push(lastUpdatedAt, now, lastContentUpdatedAt, now);

            // @ts-ignore
            transaction.update(ref, ...args);

            return { success: true };
            //
        } else if (payload.FIRESTORE_UPDATE_KITBASH) {
            //

            let { update, id } = payload;

            if (!id || !update || !stylekit.kitbash)
                return { success: false, error: "Invalid kitbash data" };

            let args = deconstructUpdates(payload.update, [
                "kitbash",
                id,
            ]).concat([lastUpdatedAt, now, lastContentUpdatedAt, now]);

            // @ts-ignore
            transaction.update(ref, ...args);

            return { success: true };
            //
        } else if (payload.FIRESTORE_DELETE_KITBASH) {
            //
            let { id } = payload;

            if (!id || !stylekit.kitbash)
                return { success: false, error: "Invalid asset data" };

            if (!stylekit.kitbash[id]) {
                return {
                    success: false,
                    error: "Kitbash Asset was deleted",
                };
            }
            let path = new firestore.FieldPath("kitbash", id);

            // @ts-ignore
            transaction.update(
                ref,
                path,
                firestore.FieldValue.delete(),
                lastUpdatedAt,
                now,
                lastContentUpdatedAt,
                now
            );
            return { success: true };
        }

        //!
        if (payload.FIRESTORE_UPDATE_Field) {
            //
            let args = deconstructUpdates(payload.update).concat(
                lastUpdatedAt,
                now
            );

            if (payload.update.artworks || payload.update.portals) {
                args.push(lastContentUpdatedAt, now);
            }
            // If there's no lastContentUpdatedAt field yet, add it
            else if (stylekit.lastContentUpdatedAt == null) {
                // if we're updating cHeroImg field set lastContentUpdatedAt to a value
                // just before lastUpdatedHeroImg to avoid infinite regeneration
                let timestamp = now;

                if (payload.update?.info?.lastUpdatedHeroImg != null) {
                    timestamp = payload.update.info.lastUpdatedHeroImg - 1;
                }
                args.push(lastContentUpdatedAt, timestamp);
            }

            console.log("[UPDATE STYLEKIT/path update]", args);
            // @ts-ignore
            transaction.update(ref, ...args);
        } else {
            console.log("[UPDATE STYLEKIT/set]", payload);

            let update = { ...payload, lastUpdatedAt: now };

            transaction.update(ref, update);
        }

        return { success: true };
    });
};

const createStylekit = async ({
    userId,
    stylekitId,
    kitbash,
    kitbashImgs,
    room,
}) => {
    //
    const stylekit: Stylekit = {
        version: 1,
        id: stylekitId,
        info: {
            curator: userId,
            room,
        },
        kitbash,
        kitbashImgs,
        editors: [userId],
        createdAt: Date.now(),
        owner: userId,
    };

    const ref = db.collection("stylekits").doc(stylekitId);

    // Saving over an existing kit is for its owner (as deleteStylekit
    // checks): new spaces in that room copy its kitbash.
    const existing = await ref.get();
    if (
        existing.exists &&
        existing.data()?.owner?.toLowerCase?.() !== userId.toLowerCase()
    ) {
        return null;
    }

    await ref.set(stylekit);

    return stylekit;
};

const deleteStylekit = async (userId, stylekitId) => {
    //
    const doc = await db.collection("stylekits").doc(stylekitId).get();

    if (!doc.exists) {
        return { success: false, error: "Can't find Stylekit " + stylekitId };
    }

    const stylekit = doc.data();

    if (stylekit.owner.toLowerCase() != userId.toLowerCase()) {
        return { success: false, error: "Get out of here" };
    }

    console.log("IS THE OWNER", stylekit.info);

    await db.collection("stylekits").doc(stylekitId).delete();
};

export default async (req, res) => {
    //
    await corsMiddleware(req, res);

    let userId;

    // We need to check first if user logged in and if he is an editor of the exhibit before he can update...

    try {
        if (req.body && typeof req.body === "string") {
            req.body = JSON.parse(req.body);
        }

        if (
            req.query.type === "CREATE_STYLEKIT" ||
            req.query.type === "UPDATE_STYLEKIT" ||
            req.query.type === "DELETE_STYLEKIT"
        ) {
            userId = await auth(req);
        }

        if (req.query.type === "GET_STYLEKIT_BY_ID") {
            //

            const stylekit = await geTStylekitById(req.query.id);

            if (stylekit == null) {
                return res.status(404).json({ success: false });
            }

            return res.status(200).json({ success: true, stylekit });
            //
        } else if (req.query.type === "GET_STYLEKIT_BY_ROOM") {
            //
            const stylekit = await getStylekitByRoom(req.query.room);

            if (stylekit == null) {
                return res.status(404).json({ success: false });
            }

            return res.status(200).json({ success: true, stylekit });
            //
        } else if (
            req.query.type === "UPDATE_STYLEKIT" &&
            req.query.id &&
            req.body.payload
        ) {
            const data = await updateStylekit(
                req.query.id,
                req.body.payload,
                userId
            );

            if (!data.success) {
                return res
                    .status(400)
                    .json({ success: false, message: data.error });
            }

            return res.status(200).json({ success: true });
            //
        } else if (req.query.type === "CREATE_STYLEKIT" && userId) {
            //
            const stylekit = await createStylekit({
                userId,
                stylekitId: req.body.stylekitId,
                kitbash: req.body.kitbash,
                kitbashImgs: req.body.kitbashImgs,
                room: req.body.room,
            });

            if (!stylekit) {
                return res.status(403).json({
                    success: false,
                    message: "This stylekit belongs to someone else.",
                });
            }

            return res.status(200).json({ success: true, stylekit });
            //
        } else if (req.query.type === "DELETE_STYLEKIT") {
            //
            await deleteStylekit(userId, req.body.stylekitId);

            return res.status(200).json({ success: true });
            //
        } else {
            return res
                .status(400)
                .json({ success: false, message: "Query not recognized." });
        }
    } catch (err) {
        console.error(err);
        return res
            .status(400)
            .json({ success: false, message: "Failed to execute operation." });
    }
};
