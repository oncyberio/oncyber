import { Asset, isUpload } from "utils/types";
import { uploadModel3D } from "utils/ipfsUpload";
import { database, firestore, realtimeDB, updateAssetInTrans } from "utils/db";
import * as logger from "firebase-functions/logger";
import { getContent } from "utils/file";
import { optimizeGLTF } from "./optimizeGLTF";
import { getUploadSizeLimit } from "./utils";

const VERSION = "v0";

export async function optimize3DAsset(
    exhibitId: string,
    asset: Asset,
    userId: string,
    sendEvent: boolean
) {
    //

    const url =
        asset.dcompressed_animation_url ||
        asset.compressed_animation_url ||
        asset.animation_url ||
        asset.animation_original_url ||
        asset.original_animation_url;

    const content = await getContent(url, getUploadSizeLimit(asset.mime_type));

    if (content == null) {
        //
        throw new Error("Exceded upload size limit");
    }

    const { hash, buffer } = content;

    const baseId = hash + "_" + VERSION;

    const rawId = `${baseId}.glb`;

    const ids = {
        high: `${baseId}_high.glb`,
        low: `${baseId}_low.glb`,
        lowCompressed: `${baseId}_low_compressed.glb`,
    };

    // let urls = await Promise.all([
    //     asset.dcompressed_animation_url || checkPublicIdExists(rawId, "raw"),
    //     checkPublicIdExists(ids.high, "raw"),
    //     checkPublicIdExists(ids.low, "raw"),
    //     checkPublicIdExists(ids.lowCompressed, "raw"),
    // ]);

    // if (urls.some((url) => url == null)) {
    //
    const { high, low, lowCompressed } = await optimizeGLTF(buffer, ids);

    let urls = [];

    if (!asset.dcompressed_animation_url) {
        urls.push(await uploadModel3D(new Uint8Array(buffer), rawId));
    } else {
        urls.push(asset.dcompressed_animation_url);
    }

    urls.push(
        await uploadModel3D(high.buffer, high.name),
        await uploadModel3D(low.buffer, low.name),
        await uploadModel3D(lowCompressed.buffer, lowCompressed.name)
    );
    // }

    logger.info("Update/start", { assetId: asset.id });

    const dbResult = await update3DAssetDB(
        userId,
        exhibitId,
        asset,
        urls,
        sendEvent
    );

    logger.info("Update/success", { assetId: asset.id });

    return dbResult;
}

export async function update3DAssetDB(
    userId: string,
    exhibitId: string,
    asset: Asset,
    urls: string[],
    sendEvent: boolean
) {
    //
    logger.log("[Upload_Media/Update_ASSET_DB]", { urls });

    // logger.info("Update/assetttttttttt", { assetId: asset.id });

    // await new Promise((resolve) => setTimeout(resolve, 1000 * 5));

    const wasUploaded = isUpload(asset);

    let d_optimized_files = {
        high: urls[1],
        low: urls[2],
        low_compressed: urls[3],
    };

    const exhibitRef = database.collection("exhibits").doc(exhibitId);

    let ps: Promise<any>[] = [];

    let updates: any = [
        new firestore.FieldPath(
            "artworks",
            asset.id,
            "data",
            "d_optimized_files"
        ),
        d_optimized_files,
    ];

    if (!asset.dcompressed_animation_url) {
        //
        updates.push(
            new firestore.FieldPath(
                "artworks",
                asset.id,
                "data",
                "dcompressed_animation_url"
            ),
            urls[0]
        );
    }

    ps.push(updateAssetInTrans(exhibitId, asset.id, updates));

    // if upload, also store the optimized files in the upload collection
    if (wasUploaded) {
        //
        const batch = database.batch();

        batch.update(
            database
                .collection("users")
                .doc(userId)
                .collection("assets-upload-content")
                .doc(asset.token_id),
            //
            "d_optimized_files",
            d_optimized_files
        );

        batch.update(
            database.collection("assets-upload-hash").doc(asset.token_id),
            "d_optimized_files",
            d_optimized_files
        );

        ps.push(
            batch
                .commit()
                .then(() =>
                    // Best-effort: keep the frontend's upload-library index
                    // (caches/upload-index-{userId}, one doc serving the whole
                    // picker) in sync. Runs AFTER the primary write so an
                    // oversized/failed index can never sink it; if the index
                    // doc doesn't exist yet this creates a skeleton without
                    // `complete`, which the frontend treats as a miss and
                    // rebuilds from the subcollection.
                    database
                        .collection("caches")
                        .doc(`upload-index-${userId}`)
                        .set(
                            {
                                v: Date.now(),
                                entries: {
                                    [asset.token_id]: { d_optimized_files },
                                },
                            },
                            { merge: true }
                        )
                        .catch(() =>
                            database
                                .collection("caches")
                                .doc(`upload-index-${userId}`)
                                .delete()
                                .catch(() => undefined)
                        )
                )
                .catch((err) => {
                    //
                    console.error(err);

                    logger.error("Update upload data/failed", {
                        assetId: asset.id,
                        err,
                    });
                })
        );
    }

    const [result, _] = await Promise.all(ps);

    if (!result.success) {
        return result;
    }

    if (sendEvent) {
        //

        realtimeDB.ref("/exhibits/" + exhibitId).push({
            type: "COMPRESSION_FINISHED_3D",
            payload: {
                assetId: asset.id,
                d_optimized_files,
                d_compressed_animation_url: urls[0],
            },
            walletId: userId,
            meshId: asset.id,
            isServerEvent: true,
            timestamp: new Date().getTime() + 1000 * 10,
        });
    }

    return {
        d_compressed_animation_url: urls[0],
        d_optimized_files,
    };
}

export function is3DAssetOptimized(asset: Asset) {
    //
    return asset.d_optimized_files != null;
}
