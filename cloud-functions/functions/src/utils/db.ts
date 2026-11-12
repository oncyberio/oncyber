import admin from "firebase-admin";
import { Asset } from "./types";
import { FieldPath } from "firebase-admin/firestore";

const credentials = {
    type: process.env.DB_ADMIN_TYPE,
    project_id: process.env.DB_ADMIN_PROJECT_ID,
    private_key_id: process.env.DB_ADMIN_PRIVATE_KEY_ID,
    private_key: process.env.DB_ADMIN_PRIVATE_KEY,
    client_email: process.env.DB_ADMIN_CLIENT_EMAIL,
    client_id: process.env.DB_ADMIN_CLIENT_ID,
    auth_uri: process.env.DB_ADMIN_AUTH_URI,
    token_uri: process.env.DB_ADMIN_TOKEN_URI,
    auth_provider_x509_cert_url: process.env.DB_ADMIN_AUTH_PROVIDER_CERT_URL,
    client_x509_cert_url: process.env.DB_ADMIN_CLIENT_CERT_URL,
};

admin.initializeApp({
    credential: admin.credential.cert(credentials as any),
    databaseURL: `https://${credentials.project_id}-default-rtdb.firebaseio.com`,
});

// admin.initializeApp();

export const database = admin.firestore();

export const firestore = admin.firestore;

export const realtimeDB = admin.database();

export async function getExhibitById(exhibitId: string) {
    //
    const doc = await database.collection("exhibits").doc(exhibitId).get();

    if (!doc.exists) {
        return null;
    }

    return { ...doc.data(), id: exhibitId } as any;
}

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

export function pathUpdate(update: object) {
    return {
        FIRESTORE_UPDATE_Field: true,
        update,
    };
}

export function updateAsset(assetId: string, update: object) {
    return {
        FIRESTORE_UPDATE_ASSET: true,
        assetId,
        update,
    };
}

export function deconstructUpdates(
    object: object,
    currentPath = [],
    args = []
) {
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

export async function updateExhibitAssetMedia(
    id: string,
    origAsset: Asset,
    payload: any,
    userId: string
) {
    //
    return database.runTransaction(async (transaction) => {
        //
        const ref = database.collection("exhibits").doc(id);

        const doc = await transaction.get(ref);

        if (!doc.exists) return;

        const exhibit = doc.data();

        if (payload.FIRESTORE_UPDATE_ASSET) {
            // We shouldn't allow changing fields like owner, animation_url, etc..
            let { update, assetId } = payload;

            if (!assetId || !update)
                return { success: false, error: "Invalid asset data" };

            let asset = exhibit.artworks[assetId]?.data as Asset;

            if (!asset) {
                return {
                    success: false,
                    error: "Asset was deleted",
                };
            }

            if (
                asset.contract_address !== origAsset.contract_address ||
                asset.token_id !== origAsset.token_id ||
                asset.image_url !== origAsset.image_url ||
                asset.animation_url !== origAsset.animation_url ||
                asset.dcompressed_image_url !==
                    origAsset.dcompressed_image_url ||
                asset.dcompressed_animation_url !==
                    origAsset.dcompressed_animation_url
            ) {
                // logger.warn("Asset was modified", {
                //     old: origAsset,
                //     new: asset,
                // });

                return {
                    success: false,
                    error: "Asset was modified",
                };
            }

            let args = deconstructUpdates(payload.update, [
                "artworks",
                assetId,
            ]);

            // @ts-ignore
            transaction.update(ref, ...args);

            return { success: true };
        }
        return { success: false };
    });
}

export async function updateExhibit(id: string, payload: any) {
    return database.runTransaction(async (transaction) => {
        const ref = database.collection("exhibits").doc(id);

        const doc = await transaction.get(ref);

        if (!doc.exists) return;

        const exhibit = doc.data();

        let lastUpdatedAt = new firestore.FieldPath("lastUpdatedAt");

        let lastContentUpdatedAt = new firestore.FieldPath(
            "lastContentUpdatedAt"
        );

        let now = Date.now();

        //!
        if (payload.FIRESTORE_UPDATE_Field) {
            //
            let args = deconstructUpdates(payload.update).concat(
                lastUpdatedAt,
                now
            );

            // If there's no lastContentUpdatedAt field yet, add it
            if (exhibit.lastContentUpdatedAt == null) {
                // if we're updating cHeroImg field set lastContentUpdatedAt to a value
                // just before lastUpdatedHeroImg to avoid infinite regeneration
                let timestamp = now;

                if (payload.update?.info?.lastUpdatedHeroImg != null) {
                    timestamp = payload.update.info.lastUpdatedHeroImg - 1;
                }
                args.push(lastContentUpdatedAt, timestamp);
            }

            // @ts-ignore
            transaction.update(ref, ...args);
        }

        return { success: true };
    });
}

export async function quickUpdate(
    exhibitId: string,
    path: string[],
    value: any
) {
    //
    const ref = database.collection("exhibits").doc(exhibitId);

    if (value === undefined) {
        value = firestore.FieldValue.delete();
    }

    const wr = await ref.update(new firestore.FieldPath(...path), value);

    return wr.writeTime;
}

export async function updateAssetInTrans(
    id: string,
    assetId: string,
    updates: any
) {
    //
    return database.runTransaction(async (transaction) => {
        //
        const ref = database.collection("exhibits").doc(id);

        const doc = await transaction.get(ref);

        if (!doc.exists) return { success: false, error: "Exhibit not found" };

        const exhibit = doc.data();

        let asset = exhibit.artworks?.[assetId];

        if (!asset) {
            //
            return { success: false, error: "Asset was deleted" };
        }

        const now = Date.now();

        updates.push(
            new FieldPath("lastUpdatedAt"),
            now,
            new FieldPath("lastContentUpdatedAt"),
            now
        );

        // @ts-ignore
        transaction.update(ref, ...updates);

        return { success: true };
    });
}

/** Only an exhibit's owner or editors may trigger work on it. */
export async function canEditExhibit(exhibitId: string, userId: string) {
    if (!exhibitId || !userId) return false;
    const doc = await database.collection("exhibits").doc(exhibitId).get();
    const exhibit: any = doc.exists ? doc.data() : null;
    const id = String(userId).toLowerCase();
    return !!exhibit && (exhibit.owner?.toLowerCase() === id ||
        (exhibit.editors || []).some((e: string) => e?.toLowerCase() === id));
}
