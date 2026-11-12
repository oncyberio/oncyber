import { Asset, MediaInfo, Success } from "utils/types";
import { uploadIPFS } from "utils/ipfsUpload";
import {
    getExhibitById,
    realtimeDB,
    updateAsset,
    updateExhibitAssetMedia,
} from "utils/db";
import * as logger from "firebase-functions/logger";
import { getAssetMediaInfo } from "utils/getAssetMediaInfo";
import { getContent } from "utils/file";
import { getUploadSizeLimit } from "./utils";

export async function optimize2DAsset(
    exhibitId: string,
    asset: Asset,
    userId: string,
    sendEvent: boolean
) {
    //

    const result = await getAssetMediaInfo(asset);

    if (result?.mediaInfo == null && result?.coverMediaInfo == null) {
        throw new Error("Media isn't uploadable");
    }

    //
    const { mediaInfo, coverMediaInfo } = result;

    const [content, coverContent] = await Promise.all([
        mediaInfo
            ? getContent(mediaInfo.url, getUploadSizeLimit(mediaInfo.mime_type))
            : null,
        coverMediaInfo
            ? getContent(
                  coverMediaInfo.url,
                  getUploadSizeLimit(coverMediaInfo.url)
              )
            : null,
    ]);

    const publicId = content?.hash;
    const coverPublicId = coverContent?.hash;

    // Cloudinary is gone (401): pin the already-downloaded bytes to IPFS,
    // like optimize3DAsset does. No server-side resize/transcode anymore.
    const pin = async (content, publicId: string, info: MediaInfo) => {
        const result = await uploadIPFS(
            content.buffer,
            publicId,
            info.mime_type
        );
        info.url = result.secure_url;
        return result;
    };

    const results = await Promise.all([
        publicId ? pin(content, publicId, mediaInfo) : null,
        coverPublicId
            ? pin(coverContent, coverPublicId, coverMediaInfo)
            : null,
    ]);

    logger.info("Update/start", { assetId: asset.id });

    const dbResult = await updateAssetMedia(
        userId,
        exhibitId,
        asset,
        results[0] ? mediaInfo : null,
        results[1] ? coverMediaInfo : null,
        sendEvent
    );

    logger.info("Update/success", { assetId: asset.id });

    return dbResult;
}

export async function updateAssetMedia(
    userId: string,
    exhibitId: string,
    asset: Asset,
    mediaInfo: MediaInfo,
    coverMediaInfo: MediaInfo,
    sendEvent: boolean
) {
    //
    // console.log("[Upload_Media/Update_ASSET_DB]");

    let update = {
        data: {} as any,
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
    let updateResult = await updateExhibitAssetMedia(
        exhibitId,
        asset,
        updateAsset(asset.id, update),
        userId
    );

    if (!updateResult.success) {
        throw new Error(updateResult.error || "Failed to save asset media");
    }

    if (sendEvent) {
        //

        realtimeDB.ref("/exhibits/" + exhibitId).push({
            type: "COMPRESSION_FINISHED",
            payload: {
                contract_address: asset.contract_address,
                token_id: asset.token_id,
                urlField: urlField || null,
                mediaInfo: mediaInfo || null,
                coverMediaInfo: coverMediaInfo || null,
            },
            walletId: userId,
            meshId: asset.id,
            isServerEvent: true,
            timestamp: new Date().getTime() + 1000 * 10,
        });
    }

    return update.data;
}

export function is2DAssetOptimized(asset: Asset) {
    //
    if (asset.mime_type == null) {
        logger.error("Asset has no mime-type", { assetId: asset.id });
        return false;
    }

    if (asset.mime_type.startsWith("image")) {
        return asset.dcompressed_image_url != null;
    } else if (asset.mime_type.startsWith("video")) {
        return asset.dcompressed_animation_url != null;
    } else if (asset.mime_type.startsWith("audio")) {
        return (
            asset.dcompressed_animation_url != null &&
            asset.mime_type === "audio/mpeg"
        );
    }

    return false;
}
