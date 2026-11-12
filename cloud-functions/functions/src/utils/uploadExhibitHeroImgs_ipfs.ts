import { pathUpdate, realtimeDB, updateExhibit } from "./db";
import { uploadIPFS } from "./ipfsUpload";

type UploadResult = Awaited<ReturnType<typeof uploadIPFS>>;

async function uploadExhibitMedia(
    exhibitId: string,
    suffix: string,
    url: string,
    portalId: string
) {
    let publicId: string;

    if (portalId) {
        publicId = `exhibit_preview_${suffix}_${exhibitId}_${portalId}`;
    } else if (suffix === "feed") {
        publicId = `feed_preview_${exhibitId}`;
    } else {
        publicId = `exhibit_preview_${suffix}_${exhibitId}`;
    }

    const result = await uploadIPFS(url, publicId, "image/jpg");

    return result;
}

async function updateExhibitHeroImg(
    userId: string,
    exhibitId: string,
    result: UploadResult,
    result360: UploadResult,
    fresult: UploadResult
) {
    const payload: any = { info: {} };

    if (result) {
        payload.info.cHeroImg = result.secure_url;
    }

    if (result360) {
        payload.info.cHeroImg360 = result360.secure_url;
    }

    if (fresult) {
        payload.info.fHeroImg = fresult.secure_url;
    }

    if (result360) {
        payload.info.lastUpdatedHeroImg = Date.now();
    }

    let update = pathUpdate(payload);

    let updateResult = await updateExhibit(exhibitId, update);

    if (updateResult == null) {
        throw new Error("Failed to find exhibit " + exhibitId);
    }

    if (updateResult.success) {
        realtimeDB.ref("/exhibits/" + exhibitId).push({
            type: "EXHIBIT_HERO_IMG_UPLOADED",
            payload,
            walletId: userId,
            isServerEvent: true,
            timestamp: new Date().getTime() + 1000 * 10,
        });
    } else {
        throw new Error("Failed to update exhibit hero img");
    }
    return { ...updateResult, payload };
}

export interface UploadExhibitPreviewOpts {
    userId: string;
    exhibitId: string;
    portalId?: string;
    heroImg?: string;
    heroImg360?: string;
    fHeroImg: string;
}

export async function uploadExhibitPreviews(opts: UploadExhibitPreviewOpts) {
    //

    const { userId, exhibitId, heroImg, heroImg360, portalId, fHeroImg } = opts;

    let result = null,
        result360 = null,
        fresult = null;

    if (heroImg) {
        result = await uploadExhibitMedia(exhibitId, "2d", heroImg, portalId);
    }

    if (heroImg360) {
        result360 = await uploadExhibitMedia(
            exhibitId,
            "360",
            heroImg360,
            portalId
        );
    }

    if (fHeroImg) {
        fresult = await uploadExhibitMedia(
            exhibitId,
            "feed",
            fHeroImg,
            portalId
        );
    }

    if (portalId)
        return {
            payload: null,
            url: result?.secure_url,
            url360: result360?.secure_url,
            furl: fresult?.secure_url,
        };

    const compressionResult = await updateExhibitHeroImg(
        userId,
        exhibitId,
        result,
        result360,
        fresult
    );

    return {
        payload: compressionResult.payload,
        url: result?.secure_url,
        url360: result360?.secure_url,
        furl: fresult?.secure_url,
    };
}
