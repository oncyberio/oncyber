import { z } from "zod";
import { proc, NoApi } from "@utils/rpc/server";
import { firestore } from "firebase-admin";
import { db } from "@utils/firebaseAdmin";
import { Experience } from "@uitypes/experience";
import { validateKitbashItem } from "@utils/worldContent/componentSchemas";
import { GALLERY_SCRIPTS_RETIRED, isLegacyGalleryScriptPath } from "@utils/legacyGalleryScripts";
import {
    applySecretWrite,
    secureGatingPatches,
} from "@utils/worldPassword/server";

const allowedFields = [
    "artworks",
    "portals",
    "kitbash",
    "hasKitbash",
    "info",
    "params",
    "gating",
];

const infoBlackList: Array<keyof Experience["info"]> = [
    "room",
    "customLink",
    "curator",
    "currentSkin",
    "lastUpdatedHeroImg",
    "cHeroImg",
    "cHeroImg360",
    "fHeroImg",
];

const patchSchema = z.object({
    op: z.union([z.literal("add"), z.literal("replace"), z.literal("remove")]),
    path: z
        .array(z.string())
        .min(1)
        .refine(
            (elems) => {
                //
                const field = elems[0];

                if (!allowedFields.includes(field)) return false;

                if (field === "info") {
                    //
                    return !infoBlackList.includes(elems[1] as any);
                }

                return true;
            },
            { message: "Invalid field" }
        ),
    value: z.any().optional(),
});

type Patch = z.infer<typeof patchSchema>;

const isEditor = ( exhibit: Experience, userId: string) => {
    //
    let result = exhibit.editors?.some(
        (id) => id.toLowerCase() == userId?.toLowerCase()
    );
    return result;

};

function isAllowedContentEdition(exhibit: Experience, patches: Patch[]) {
    if (!exhibit?.params?.editionAllowed) return false;
    if (patches.map(isContentUpdate).some(x=>!x)) return false;
    return true;
}

function isOwner(userId: string, exhibit: Experience) {
    //
    return exhibit.owner?.toLowerCase() == userId?.toLowerCase();
}

function isContentUpdate({ path }: Patch) {
    //
    const scope = path[0];

    const subScope = path.length > 1 ? path[1] : null;

    return (
        scope === "artworks" ||
        scope === "portals" ||
        scope === "kitbash" ||
        (scope === "params" &&
            (subScope === "initialPlayerPosition" ||
                subScope === "initialPlayerRotation"))
    );
}

function validatePatch(
    patch: Patch,
    exhibit: Experience,
    userId: string,
    hasPortalCollection: boolean
) {
    //
    const { op, path } = patch;

    const scope = path[0];

    if (scope === "kitbash") {
        // Only a whole-item write (`["kitbash", id]`) is checked — a deep
        // partial-field patch (`["kitbash", id, "position", "x"]`) isn't a
        // full item and isn't validated here. Still closes the gap for the
        // common case: the studio's own add/replace flow and the new
        // world-content API/CLI both write whole items.
        if (op !== "remove" && path.length === 2) {
            const result = validateKitbashItem(patch.value);

            if (!result.success) {
                throw new Error(`Invalid kitbash item: ${result.error}`);
            }
        }

        return;
    }

    if (scope === "portals") return;

    if (scope === "info" || scope === "params") {
        //
        if (!isOwner(userId, exhibit)) {
            //
            throw new Error("Forbidden");
        }
    }

    if (op === "remove") return;

    // ensure the object designed in the path exists
    // path = [...object-path, prop]
    let current = exhibit;

    for (let i = 0; i < path.length - 1; i++) {
        //
        let key = path[i];

        current = current[key];

        if (current == null) {
            //
            throw new Error("Invalid patch");
        }
    }
}

const FIELDS = {
    lastUpdatedAt: new firestore.FieldPath("lastUpdatedAt"),
    lastContentUpdatedAt: new firestore.FieldPath("lastContentUpdatedAt"),
};

function updateChildCollection(
    transaction: firestore.Transaction,
    collection: string,
    parentRef: firestore.DocumentReference,
    patches: Patch[]
) {
    //
    patches.forEach((patch) => {
        //
        if (patch.path[0] !== collection) return;

        const docId = patch.path[1];

        const docRef = parentRef.collection(collection).doc(docId);

        if (patch.path.length === 2) {
            //
            if (patch.op === "remove") {
                //
                transaction.delete(docRef);
            } else {
                //
                transaction.set(docRef, patch.value);
            }
        } else {
            //
            transaction.update(
                docRef,
                new firestore.FieldPath(...patch.path.slice(2)),
                patch.op === "remove"
                    ? firestore.FieldValue.delete()
                    : patch.value
            );
        }
    });
}

export async function updateExhibit(
    id: string,
    patches: Patch[],
    userId: string,
    precondition = (exhibit) =>
        (isEditor(exhibit, userId) || isAllowedContentEdition(exhibit, patches))
) {
    // Apply the same guard to trusted internal callers that bypass RPC parsing.
    if (patches.some((patch) => isLegacyGalleryScriptPath(patch.path))) {
        return { success: false, error: GALLERY_SCRIPTS_RETIRED };
    }
    return db.runTransaction(async (transaction) => {
        //
        const ref = db.collection("exhibits").doc(id);

        const doc = await transaction.get(ref);

        if (!doc.exists) return;

        const exhibit = doc.data() as Experience;

        if (!precondition(exhibit))
            return {
                success: false,
                error: "Get out of here",
            };

        if (exhibit.pendingTransaction) {
            //
            return { success: false, error: "Pending transaction" };
        }

        let now = Date.now();

        let args = [];

        const hasPortalCollection = exhibit.storageVersion === 2;

        let hasContentUpdate = false;

        patches.forEach((patch) => {
            return validatePatch(patch, exhibit, userId, hasPortalCollection);
        });

        // A world password is stored hashed, apart from the exhibit; the
        // exhibit keeps only its message and revision.
        // validatePatch above has checked each one, so op and path are set
        // although the request schema types them as optional.
        const secured = await secureGatingPatches(
            patches as Parameters<typeof secureGatingPatches>[0],
            exhibit.gating
        );

        patches = secured.patches;

        applySecretWrite(transaction, id, secured.secretWrite);

        patches.forEach((patch) => {
            //
            if (patch.path[0] === "kitbash") return;

            if (hasPortalCollection && patch.path[0] === "portals") {
                // if portals are in a separate collection we'll update
                // portal docs in a separate pass

                // const portalId = patch.path[1];

                // if (exhibit.portals[portalId]) {
                //     // But we need to cleanup the old entry in exhibit if present
                //     args.push(
                //         new firestore.FieldPath("portals", portalId),
                //         firestore.FieldValue.delete()
                //     );
                // }
                return;
            }

            if (!hasContentUpdate && isContentUpdate(patch)) {
                //
                hasContentUpdate = true;
            }

            args.push(
                new firestore.FieldPath(...patch.path),
                patch.op === "remove"
                    ? firestore.FieldValue.delete()
                    : patch.value
            );
        });

        args.push(FIELDS.lastUpdatedAt, now);

        if (hasContentUpdate || exhibit.lastContentUpdatedAt == null) {
            //
            args.push(FIELDS.lastContentUpdatedAt, now);
            //
        }

        // @ts-ignore
        transaction.update(ref, ...args);

        if (hasPortalCollection) {
            //
            updateChildCollection(transaction, "portals", ref, patches);
        }

        updateChildCollection(transaction, "kitbash", ref, patches);

        return { success: true };
    });
}

// Firestore caps a single transaction at 500 writes. `updateChildCollection`
// turns every whole-item kitbash/portal patch into its own write, plus one
// more for the main doc — so a big generation pass (bulk terrain/mesh/light
// inserts) can blow past that in one `updateExhibit` call. None of the
// existing callers (studio autosave) come close to this in practice, so
// chunking is applied generically here rather than changing `updateExhibit`
// itself: below the threshold this is exactly the old single-transaction
// behavior; above it, the same patch array is just applied across sequential
// transactions instead of one.
const MAX_PATCHES_PER_TRANSACTION = 400;

async function updateExhibitChunked(id: string, patches: Patch[], userId: string) {
    if (patches.length <= MAX_PATCHES_PER_TRANSACTION) {
        return updateExhibit(id, patches, userId);
    }

    let last: Awaited<ReturnType<typeof updateExhibit>>;

    for (let i = 0; i < patches.length; i += MAX_PATCHES_PER_TRANSACTION) {
        const chunk = patches.slice(i, i + MAX_PATCHES_PER_TRANSACTION);

        last = await updateExhibit(id, chunk, userId);

        if (!last?.success) return last;
    }

    return last;
}

export const update = proc({
    auth: true,
    cors: true,

    // schema
    schema: z.object({
        id: z.string().min(1),
        patches: z.array(patchSchema),
    }),

    // handler
    async handler({ id, patches }) {
        // throw new Error("no greet")
        return updateExhibitChunked(id, patches, this.userId);
    },
});

/**
 * Not found, All apis are accessible from index file
 */
export default NoApi;
