import { z } from "zod";
import { NoApi } from "@utils/rpc/server";
import { UploadableMediaInfo } from "@uitypes/mediaInfo";
import { updateExhibit } from "../../exhibit";
import { updateAsset } from "@utils/saveToDb";
import { database } from "@utils/firebase";
import { ArtworkData } from "@uitypes/experience";
import { push, ref } from "firebase/database";
import { isExhibitOwnerOrEditor } from "@utils/firestore/exhibitEditors";

export const zodMediaInfoSchema = z.object({
    type: z.literal("Uploadable"),
    mime_type: z.string().min(1),
    urlField: z.string().min(1),
    url: z.string().min(1),
});

export async function updateAssetMedia(
    userId: string,
    exhibitId: string,
    assetId: string,
    contract_address: string,
    token_id: string,
    mediaInfo: UploadableMediaInfo,
    coverMediaInfo: UploadableMediaInfo
) {
    //
    console.log("[Upload_Media/Update_ASSET_DB]");

    const precondition = (exhibit) => {
        // This replaces updateExhibit's default editor check, so it makes it
        // too; a space open to visitors' content (editionAllowed, as in
        // _v2/exhibit/update) also lets them optimise what they added.
        if (
            !isExhibitOwnerOrEditor(exhibit, userId) &&
            !exhibit?.params?.editionAllowed
        )
            return { success: false, error: "Get out of here" };
        const asset = exhibit.artworks[assetId];
        if (asset == null)
            return { success: false, error: "Asset was deleted" };
        if (asset[urlField])
            return { success: false, error: "Asset already optimised" };
        return { success: true };
    };

    let update = {
        data: {} as Partial<ArtworkData["data"]>,
    };

    let urlField;

    if (mediaInfo) {
        const urlType = mediaInfo.mime_type.startsWith("image")
            ? "image"
            : "animation";

        urlField = `dcompressed_${urlType}_url`;

        update.data[urlField] = mediaInfo.url;
        update.data.mime_type = mediaInfo.mime_type;
    }

    if (coverMediaInfo) {
        update.data.dcompressed_image_url = coverMediaInfo.url;
        update.data.cover_mime_type = coverMediaInfo.mime_type;
    }

    // @ts-ignore
    let updateResult = await updateExhibit(
        exhibitId,
        updateAsset(assetId, update),
        userId,
        precondition
    );

    if (!updateResult.success) {
        throw new Error(updateResult.error || "Failed to save asset media");
    }

    console.log("[Upload_Media/Update_ASSET_DB]", "sending compression event");

    push(ref(database, "/exhibits/" + exhibitId), {
        type: "COMPRESSION_FINISHED",
        payload: {
            contract_address,
            token_id,
            urlField: urlField || null,
            mediaInfo: mediaInfo || null,
            coverMediaInfo,
        },
        walletId: userId,
        meshId: assetId,
        isServerEvent: true,
        timestamp: new Date().getTime() + 1000 * 10,
    });

    // database.ref("/exhibits/" + exhibitId).push({
    //     type: "COMPRESSION_FINISHED",
    //     payload: {
    //         contract_address,
    //         token_id,
    //         urlField: urlField || null,
    //         mediaInfo: mediaInfo || null,
    //         coverMediaInfo,
    //     },
    //     walletId: userId,
    //     meshId: assetId,
    //     isServerEvent: true,
    //     timestamp: new Date().getTime() + 1000 * 10,
    // });
}

/**
 * Not found, All apis are accessible from index file
 */
export default NoApi;
